#!/usr/bin/env bash
# Proves the worker's checkout path works with the shared repository cache fully write-protected -
# which is what it now is, because the Kubernetes Job mounts the PVC read-only (Cratis/Stagehand#245).
#
# It also shows why the two calls this removed had to go: `git -C <cache> fetch` and
# `git -C <cache> worktree prune` both write inside the mirror, so against a read-only mount they
# could only ever fail. Freshness is restored in the worker's own clone instead.
#
# Every git commit/fetch below that can actually succeed disables maintenance.auto/gc.auto - both
# shell out to a separate, backgrounded `git maintenance run --auto --detach` by default (verified
# against git's own source), which #701 root-caused for the mirror-compaction spec and which caused
# a runner-only flake in terminated-worker-pushes-commits.sh. Nothing in a throwaway, single-use
# repo benefits from opportunistic background housekeeping.
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)/gittest-read-only"
chmod -R u+w "$ROOT" 2>/dev/null; rm -rf "$ROOT"; mkdir -p "$ROOT"; cd "$ROOT" || exit 1

git init -q upstream
git -C upstream config user.email a@b.c; git -C upstream config user.name t
echo "as at the mirror's last refresh" > upstream/file.cs
git -C upstream add .; git -c maintenance.auto=false -c gc.auto=0 -C upstream commit -qm init

git clone -q --mirror upstream cache.git

# A push the backend has not mirrored yet - the worker has to end up on this commit, not on the
# mirror's HEAD, and it has to get there without writing to the mirror.
echo "pushed after the mirror was refreshed" > upstream/file.cs
git -c maintenance.auto=false -c gc.auto=0 -C upstream commit -qam "later commit"

# The read-only mount, as far as this user is concerned.
chmod -R a-w cache.git

# A snapshot of every path, size and modification time under the mirror, to prove at the end that
# none of what follows touched it.
snapshot_cache() { find cache.git -printf '%p %s %T@\n' | sort; }
before=$(snapshot_cache)

echo "=== the mirror is read-only ==="
git -c maintenance.auto=false -c gc.auto=0 -C cache.git fetch --prune "$ROOT/upstream" '+refs/*:refs/*' >"$ROOT/fetch.log" 2>&1
fetch_status=$?
sed 's/^/  /' "$ROOT/fetch.log"
if [[ $fetch_status -eq 0 ]]; then
    echo "  UNEXPECTED: fetching inside the cache succeeded"
else
    echo "  RESULT: fetching inside the cache fails - which is why the worker no longer tries"
fi

echo
echo "=== what the worker does now ==="
git config --global --add safe.directory "$ROOT/cache.git"
git clone -q --shared cache.git "$ROOT/checkout" 2>&1 | sed 's/^/  /' || { echo "  FAILED to clone from the cache"; exit 1; }
echo "  cloned from the cache, borrowing $(sed "s|$ROOT/||" checkout/.git/objects/info/alternates)"
git -C checkout config user.email a@b.c; git -C checkout config user.name t

default_ref=$(git ls-remote --symref "$ROOT/upstream" HEAD 2>/dev/null | awk '/^ref:/ {print $2; exit}')
echo "  remote default branch: ${default_ref}"
if [[ -n "$default_ref" ]] && git -c maintenance.auto=false -c gc.auto=0 -C checkout fetch --quiet "$ROOT/upstream" "$default_ref"; then
    git -C checkout checkout -qB work FETCH_HEAD || { echo "  FAILED to create the work branch"; exit 1; }
    echo "  refreshed from origin into the worker's own object store"
else
    echo "  FAILED to refresh from origin"
    exit 1
fi

echo "  starting content: $(cat checkout/file.cs)"
sed -i'' -e 's/pushed/PUSHED/' checkout/file.cs
git -C checkout add .
git -c maintenance.auto=false -c gc.auto=0 -C checkout commit -qm "agent's change" 2>&1 | sed 's/^/  /'
git -C checkout push -q "$ROOT/upstream" HEAD:refs/heads/work 2>&1 | sed 's/^/  /'
echo "  pushed: $(git -C upstream log --oneline work -1)"
echo "  content upstream: $(git -C upstream show work:file.cs)"

echo
echo "=== the mirror was not written to ==="
if [[ "$before" == "$(snapshot_cache)" ]]; then
    echo "  RESULT: nothing in the cache changed"
else
    echo "  UNEXPECTED: something in the cache changed"
    diff <(printf '%s\n' "$before") <(snapshot_cache) | sed 's/^/  /'
fi
