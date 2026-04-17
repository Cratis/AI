#!/usr/bin/env bash
# Propagates Copilot instruction files from the source repository to a single
# target repository in the Cratis organization, pushing the commit directly to
# the default branch (no PR).
# Called by .github/workflows/propagate-copilot-instructions.yml for each
# matrix job (one per target repository).
#
# Symlink handling: files in .github/instructions/ (and .github/copilot-
# instructions.md) may be Git symlinks (mode 120000) pointing into .ai/rules/.
# The GitHub API returns the raw symlink target path as the blob content rather
# than the resolved file.  This script detects symlink entries, resolves their
# target paths relative to the symlink location, and substitutes the real
# file's SHA so that target repositories receive the actual instruction content.
#
# Expects:
#   GH_TOKEN      - PAT with Contents (r/w).  The PAT owner must be a bypass
#                   actor on the target repository's branch protection ruleset
#                   so that the direct push to the default branch is allowed.
#   SOURCE_REPO   - source repository in owner/repo format (e.g. Cratis/AI)
#   TARGET_REPO   - target repository name (e.g. Chronicle)

set -euo pipefail

# Extract a SHA from a gh api JSON response.  Returns empty string if:
#   - the response is empty
#   - the jq path does not exist
#   - the value is not a valid 40-char hex SHA
# Usage: sha=$(extract_sha "$response" '.sha')
extract_sha() {
  local response="$1" jq_path="${2:-.sha}"
  local val
  val=$(echo "$response" | jq -r "$jq_path // empty" 2>/dev/null || true)
  # Validate: must look like a git SHA (40 or 64 hex chars)
  if [[ "$val" =~ ^[0-9a-f]{40,64}$ ]]; then
    echo "$val"
  fi
}

source_repo="${SOURCE_REPO:?SOURCE_REPO must be set}"
repo="${TARGET_REPO:?TARGET_REPO must be set}"

# ----------------------------------------------------------------
# Fetch Copilot files from the source repository
# ----------------------------------------------------------------
echo "Fetching Copilot instruction files from ${source_repo}..."
source_tree_raw=$(gh api "repos/${source_repo}/git/trees/HEAD?recursive=1" 2>/dev/null || true)

if [ -z "$source_tree_raw" ]; then
  echo "::error::Could not fetch tree from ${source_repo}"
  exit 1
fi

# Include mode so that symlinks (mode "120000") can be detected and resolved.
copilot_files=$(echo "$source_tree_raw" | jq -c \
  '[.tree[] | select(.type == "blob") |
   select(
     (.path | test("^\\.github/(copilot-instructions\\.md$|instructions/|agents/|skills/|prompts/|hooks/)"))
     or (.path | test("^\\.ai/"))
     or (.path | test("^\\.claude/"))
   ) |
   {path: .path, sha: .sha, mode: .mode}]' 2>/dev/null || true)

if [ -z "$copilot_files" ] || [ "$copilot_files" = "[]" ]; then
  echo "No Copilot instruction files found in ${source_repo} — nothing to propagate."
  exit 0
fi
echo "✓ Found $(echo "$copilot_files" | jq 'length') Copilot file(s) in ${source_repo}"

# ----------------------------------------------------------------
# Filter out files matching .copilot-sync-ignore patterns
# ----------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=copilot-sync-ignore-filter.sh
source "${SCRIPT_DIR}/copilot-sync-ignore-filter.sh"

if ! _apply_copilot_sync_ignore; then
  echo "All Copilot files excluded by .copilot-sync-ignore — nothing to propagate."
  exit 0
fi

# ----------------------------------------------------------------
# Resolve symbolic links.
# Symlink blobs have Git mode "120000".  Their blob content (base64-
# decoded) is the relative target path from the symlink's directory.
# We resolve the path and substitute the real file's SHA so that
# target repositories receive actual instruction content rather than
# the bare path string that the GitHub API returns for symlink blobs.
# ----------------------------------------------------------------
resolve_symlinks_in_files() {
  local resolved='[]'
  local file_path file_sha file_mode
  local blob_resp symlink_target dir resolved_path real_sha

  while IFS=$'\t' read -r file_path file_sha file_mode; do
    [ -z "$file_path" ] && continue

    if [ "$file_mode" != "120000" ]; then
      # Regular file — keep as-is (drop mode field; downstream only needs path+sha)
      resolved=$(echo "$resolved" | jq -c \
        --arg p "$file_path" --arg s "$file_sha" \
        '. + [{path: $p, sha: $s}]')
      continue
    fi

    # Fetch the symlink blob to obtain the target path (base64-encoded by API)
    blob_resp=$(gh api "repos/${source_repo}/git/blobs/${file_sha}" \
      2>/dev/null || true)
    if [ -z "$blob_resp" ]; then
      echo "::warning::Could not read symlink blob for ${file_path} — skipping" >&2
      continue
    fi

    symlink_target=$(echo "$blob_resp" \
      | jq -r '.content // ""' \
      | base64 -d 2>/dev/null \
      | tr -d '\n')

    if [ -z "$symlink_target" ]; then
      echo "::warning::Empty symlink target for ${file_path} — skipping" >&2
      continue
    fi

    # Resolve the relative target against the symlink's directory
    dir=$(dirname "$file_path")
    resolved_path=$(python3 - "$dir" "$symlink_target" <<'EOF'
import os.path, sys
print(os.path.normpath(os.path.join(sys.argv[1], sys.argv[2])))
EOF
)

    # Look up the real file's SHA in the source tree (must not itself be a symlink)
    real_sha=$(echo "$source_tree_raw" | jq -r \
      --arg rp "$resolved_path" \
      '.tree[] | select(.path == $rp and .type == "blob" and .mode != "120000") | .sha // empty' \
      2>/dev/null | head -1 || true)

    if [ -z "$real_sha" ]; then
      echo "::warning::Symlink ${file_path} -> ${symlink_target} resolves to ${resolved_path} but no matching file found in source tree — skipping" >&2
      continue
    fi

    echo "  Resolved symlink: ${file_path} -> ${resolved_path}" >&2
    resolved=$(echo "$resolved" | jq -c \
      --arg p "$file_path" --arg s "$real_sha" \
      '. + [{path: $p, sha: $s}]')
  done <<< "$(echo "$copilot_files" \
    | jq -r '.[] | .path + "\t" + .sha + "\t" + .mode' \
    2>/dev/null || true)"

  echo "$resolved"
}

copilot_files=$(resolve_symlinks_in_files)

if [ -z "$copilot_files" ] || [ "$copilot_files" = "[]" ]; then
  echo "No files remaining after symlink resolution — nothing to propagate."
  exit 0
fi

echo "Processing Cratis/${repo}..."

# ----------------------------------------------------------------
# 1. Get default branch and HEAD SHA
# ----------------------------------------------------------------
repo_info_error=$(mktemp)
default_branch=$(gh api "repos/Cratis/${repo}" \
  --jq '.default_branch' \
  2>"$repo_info_error" || true)
if [ -z "$default_branch" ]; then
  repo_info_api_error=$(cat "$repo_info_error" 2>/dev/null || true)
  echo "::error::Could not get default branch for ${repo}"
  [ -n "$repo_info_api_error" ] && echo "  API error: $repo_info_api_error"
  rm -f "$repo_info_error"
  exit 1
fi
rm -f "$repo_info_error"

head_sha_error=$(mktemp)
_head_sha_resp=$(gh api "repos/Cratis/${repo}/git/ref/heads/${default_branch}" \
  2>"$head_sha_error" || true)
head_sha=$(extract_sha "$_head_sha_resp" '.object.sha')
if [ -z "$head_sha" ]; then
  head_sha_api_error=$(cat "$head_sha_error" 2>/dev/null || true)
  echo "::error::Could not get HEAD SHA for ${repo} (${default_branch} branch not found)"
  [ -n "$head_sha_api_error" ] && echo "  API error: $head_sha_api_error"
  rm -f "$head_sha_error"
  exit 1
fi
rm -f "$head_sha_error"

# ----------------------------------------------------------------
# 2. Get the commit's tree SHA and current full tree
# ----------------------------------------------------------------
tree_sha_error=$(mktemp)
_tree_sha_resp=$(gh api "repos/Cratis/${repo}/git/commits/${head_sha}" \
  2>"$tree_sha_error" || true)
tree_sha=$(extract_sha "$_tree_sha_resp" '.tree.sha')
if [ -z "$tree_sha" ]; then
  tree_sha_api_error=$(cat "$tree_sha_error" 2>/dev/null || true)
  echo "::error::Could not get tree SHA for ${repo}"
  [ -n "$tree_sha_api_error" ] && echo "  API error: $tree_sha_api_error"
  rm -f "$tree_sha_error"
  exit 1
fi
rm -f "$tree_sha_error"

subtree_error=$(mktemp)
subtree=$(gh api "repos/Cratis/${repo}/git/trees/${tree_sha}?recursive=1" \
  2>"$subtree_error" || true)
if [ -z "$subtree" ]; then
  subtree_api_error=$(cat "$subtree_error" 2>/dev/null || true)
  echo "::error::Could not get tree for ${repo}"
  [ -n "$subtree_api_error" ] && echo "  API error: $subtree_api_error"
  rm -f "$subtree_error"
  exit 1
fi
rm -f "$subtree_error"

# ----------------------------------------------------------------
# 3. Check whether all copilot files are already up to date
#    (git blob SHAs are content-addressed across repositories)
# ----------------------------------------------------------------
files_up_to_date=true
while IFS=' ' read -r chk_path chk_sha; do
  [ -z "$chk_path" ] && continue
  existing_sha=$(echo "$subtree" | jq -r \
    --arg p "$chk_path" \
    '.tree[] | select(.path == $p) | .sha // empty' 2>/dev/null || true)
  if [ "$existing_sha" != "$chk_sha" ]; then
    files_up_to_date=false
    break
  fi
done <<< "$(echo "$copilot_files" | jq -r '.[] | .path + " " + .sha' 2>/dev/null || true)"

if [ "$files_up_to_date" = "true" ]; then
  echo "ℹ No changes needed for ${repo} (files already up to date)"
  exit 0
fi

# ----------------------------------------------------------------
# 4. Create blobs in the target repository for each source file
# ----------------------------------------------------------------
new_tree_json=$(jq -n --arg base_tree "$tree_sha" \
  '{"base_tree": $base_tree, "tree": []}')

while IFS=' ' read -r src_path src_sha; do
  [ -z "$src_path" ] && continue

  # Fetch blob content from source repo (returned as base64 by API).
  # NOTE: zero-byte files return {"content":"","encoding":"base64"} — the
  # content field is legitimately empty.  We must check whether the API call
  # itself succeeded (non-empty JSON response), not whether content is empty.
  blob_error=$(mktemp)
  blob_resp=$(gh api "repos/${source_repo}/git/blobs/${src_sha}" \
    2>"$blob_error" || true)
  blob_api_error=$(cat "$blob_error" 2>/dev/null || true)
  rm -f "$blob_error"

  if [ -z "$blob_resp" ]; then
    echo "::error::Could not fetch blob for ${src_path} from ${source_repo}"
    [ -n "$blob_api_error" ] && echo "  API error: $blob_api_error"
    exit 1
  fi

  # Extract content; empty string is valid for zero-byte files
  blob_content=$(echo "$blob_resp" | jq -r '.content' 2>/dev/null || true)

  # Strip embedded newlines that the API inserts into base64 output
  clean_b64=$(echo "$blob_content" | tr -d '\n')

  target_blob_error=$(mktemp)
  _target_blob_resp=$(jq -n \
    --arg content "$clean_b64" \
    '{"content": $content, "encoding": "base64"}' | \
    gh api -X POST "repos/Cratis/${repo}/git/blobs" \
    --input - \
    2>"$target_blob_error" || true)
  target_blob_api_error=$(cat "$target_blob_error" 2>/dev/null || true)
  rm -f "$target_blob_error"
  target_blob_sha=$(extract_sha "$_target_blob_resp")

  if [ -z "$target_blob_sha" ]; then
    echo "::error::Could not create blob for ${src_path} in ${repo}"
    [ -n "$target_blob_api_error" ] && echo "  API error: $target_blob_api_error"
    exit 1
  fi

  new_tree_json=$(echo "$new_tree_json" | jq \
    --arg p "$src_path" \
    --arg s "$target_blob_sha" \
    '.tree += [{path: $p, mode: "100644", type: "blob", sha: $s}]')
done <<< "$(echo "$copilot_files" | jq -r '.[] | .path + " " + .sha' 2>/dev/null || true)"

# ----------------------------------------------------------------
# 5. Create new tree and commit
# ----------------------------------------------------------------
new_tree_error=$(mktemp)
_new_tree_resp=$(echo "$new_tree_json" | \
  gh api -X POST "repos/Cratis/${repo}/git/trees" \
  --input - 2>"$new_tree_error" || true)
new_tree_sha=$(extract_sha "$_new_tree_resp")

if [ -z "$new_tree_sha" ]; then
  new_tree_api_error=$(cat "$new_tree_error" 2>/dev/null || true)
  echo "::error::Could not create tree for ${repo}"
  [ -n "$new_tree_api_error" ] && echo "  API error: $new_tree_api_error"
  rm -f "$new_tree_error"
  exit 1
fi
rm -f "$new_tree_error"

commit_error=$(mktemp)
_commit_resp=$(jq -n \
  --arg msg  "Sync Copilot instructions from ${source_repo}" \
  --arg tree "$new_tree_sha" \
  --arg parent "$head_sha" \
  '{"message": $msg, "tree": $tree, "parents": [$parent]}' | \
  gh api -X POST "repos/Cratis/${repo}/git/commits" \
  --input - 2>"$commit_error" || true)
new_commit_sha=$(extract_sha "$_commit_resp")

if [ -z "$new_commit_sha" ]; then
  commit_api_error=$(cat "$commit_error" 2>/dev/null || true)
  echo "::error::Could not create commit for ${repo}"
  [ -n "$commit_api_error" ] && echo "  API error: $commit_api_error"
  rm -f "$commit_error"
  exit 1
fi
rm -f "$commit_error"

echo "✓ Created commit ${new_commit_sha} in ${repo}"

# ----------------------------------------------------------------
# 6. Push commit directly to the default branch
#
# A fast-forward (non-force) PATCH updates the ref only if the new
# commit is a descendant of the current HEAD — safe against races.
# The PAT owner must be configured as a bypass actor on the target
# repository's branch protection ruleset for this push to succeed.
# ----------------------------------------------------------------
push_error=$(mktemp)
push_result=$(gh api -X PATCH "repos/Cratis/${repo}/git/refs/heads/${default_branch}" \
  -f sha="$new_commit_sha" \
  -F force=false \
  2>"$push_error" || true)
updated_sha=$(extract_sha "$push_result" '.object.sha')

if [ -z "$updated_sha" ]; then
  push_api_error=$(cat "$push_error" 2>/dev/null || true)
  push_msg=$(echo "$push_result" | jq -r '.message // empty' 2>/dev/null || true)
  echo "::error::Could not push commit to ${default_branch} in ${repo}"
  [ -n "$push_api_error" ] && echo "  API error: $push_api_error"
  [ -n "$push_msg" ]       && echo "  GitHub message: $push_msg"
  rm -f "$push_error"
  exit 1
fi
rm -f "$push_error"

echo "✓ Pushed Copilot instructions directly to ${default_branch} in ${repo}"
