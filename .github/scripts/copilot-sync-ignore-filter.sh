#!/usr/bin/env bash
# Shared helper: filters copilot_files JSON array using patterns from
# .github/.copilot-sync-ignore in the source repository tree.
#
# Expects the following variables to be set by the caller:
#   source_tree_raw  - full recursive tree JSON from the source repo
#   source_repo      - source repository in owner/repo format
#   copilot_files    - JSON array of {path, sha} objects
#
# After sourcing, copilot_files will be updated in place (filtered).
# Returns 1 if all files are excluded (caller should handle the exit).

_apply_copilot_sync_ignore() {
  local ignore_sha
  ignore_sha=$(echo "$source_tree_raw" | jq -r \
    '.tree[] | select(.path == ".github/.copilot-sync-ignore") | .sha // empty' \
    2>/dev/null || true)

  [ -z "$ignore_sha" ] && return 0

  echo "ℹ Found .copilot-sync-ignore in ${source_repo}"
  local ignore_blob
  ignore_blob=$(gh api "repos/${source_repo}/git/blobs/${ignore_sha}" \
    --jq '.content' 2>/dev/null || true)
  local ignore_content
  ignore_content=$(echo "$ignore_blob" | base64 -d 2>/dev/null || true)

  [ -z "$ignore_content" ] && return 0

  # Build a combined regex from all non-comment, non-empty lines.
  # Each glob pattern is converted to a regex:
  #   **  → .*          (match across directories)
  #   *   → [^/]*       (match within a single directory)
  #   ?   → [^/]        (match a single character)
  #   .   → \.          (literal dot)
  # Patterns without an explicit root prefix default to .github/ for backward
  # compatibility. Use .ai/ or .claude/ prefixes explicitly to target those
  # propagated folders.
  local combined_regex=""
  local pattern regex
  while IFS= read -r pattern || [ -n "$pattern" ]; do
    pattern=$(echo "$pattern" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -z "$pattern" ] && continue
    [[ "$pattern" == \#* ]] && continue

    # Normalize: default unscoped patterns to .github/ for backward compatibility.
    if [[ "$pattern" != .github/* && "$pattern" != .ai/* && "$pattern" != .claude/* ]]; then
      pattern=".github/${pattern}"
    fi

    # Convert glob → regex (order matters: ** before *)
    regex=$(printf '%s' "$pattern" \
      | sed -e 's/\*\*/__GLOBSTAR__/g' \
            -e 's/\*/__STAR__/g' \
            -e 's/\./\\./g' \
            -e 's|?|[^/]|g' \
            -e 's/__GLOBSTAR__/.*/g' \
            -e 's/__STAR__/[^\/]*/g')

    if [ -n "$combined_regex" ]; then
      combined_regex="${combined_regex}|^${regex}$"
    else
      combined_regex="^${regex}$"
    fi
  done <<< "$ignore_content"

  [ -z "$combined_regex" ] && return 0

  local before_count after_count excluded
  before_count=$(echo "$copilot_files" | jq 'length')
  copilot_files=$(echo "$copilot_files" | jq -c \
    --arg regex "$combined_regex" \
    '[.[] | select(.path | test($regex) | not)]')
  after_count=$(echo "$copilot_files" | jq 'length')
  excluded=$((before_count - after_count))

  if [ "$excluded" -gt 0 ]; then
    echo "  Excluded ${excluded} file(s) matching .copilot-sync-ignore patterns"
  fi

  if [ "$copilot_files" = "[]" ]; then
    return 1
  fi

  echo "✓ After filtering: ${after_count} file(s) remaining"
}
