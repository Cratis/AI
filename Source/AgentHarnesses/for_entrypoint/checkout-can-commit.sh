#!/usr/bin/env bash
# Reproduces the production blocker - a worker cannot commit because the shared repository cache's
# object database is not writable by the user the container runs as - and shows that borrowing the
# objects instead of sharing them fixes it.
#
# Every `git commit` below disables maintenance.auto/gc.auto - it shells out to a separate,
# backgrounded `git maintenance run --auto --detach` otherwise (verified against git's own source),
# which #701 root-caused for the mirror-compaction spec and which caused a runner-only flake in
# terminated-worker-pushes-commits.sh. Harmless here either way (nothing polls a fixed timeout for
# a side effect the way that fixture does), but disabled for the same reason: nothing in a
# throwaway, single-use repo benefits from opportunistic background housekeeping.
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)/gittest"
chmod -R u+w "$ROOT" 2>/dev/null; rm -rf "$ROOT"; mkdir -p "$ROOT"; cd "$ROOT" || exit 1

git init -q upstream
git -C upstream config user.email a@b.c; git -C upstream config user.name t
echo "real behaviour lives here" > upstream/file.cs
git -C upstream add .; git -c maintenance.auto=false -c gc.auto=0 -C upstream commit -qm init

git clone -q --mirror upstream cache.git

# What the shared volume actually looks like: the object store belongs to somebody else and this
# user may read it but not add to it. chmod on the directories is enough to reproduce that.
find cache.git/objects -type d -exec chmod a-w {} \;

echo "=== OLD: git worktree add against the cache (shares its object database) ==="
git -C cache.git worktree add -q -B work "$ROOT/old-wt" HEAD 2>&1 | sed 's/^/  /'
git -C old-wt config user.email a@b.c; git -C old-wt config user.name t
sed -i'' -e 's/behaviour/behavior/' old-wt/file.cs
git -C old-wt add . 2>&1 | sed 's/^/  /'
if git -c maintenance.auto=false -c gc.auto=0 -C old-wt commit -qm "fix spelling" 2>&1 | sed 's/^/  /'; then :; fi
if git -C old-wt log --oneline -1 2>/dev/null | grep -q "fix spelling"; then
    echo "  RESULT: committed"
else
    echo "  RESULT: could not commit - this is the production failure"
fi

echo
echo "=== NEW: git clone --shared from the cache (borrows its object database) ==="
git clone -q --shared cache.git "$ROOT/new-clone" 2>&1 | sed 's/^/  /'
git -C new-clone config user.email a@b.c; git -C new-clone config user.name t
git -C new-clone checkout -qB work
sed -i'' -e 's/behaviour/behavior/' new-clone/file.cs
git -C new-clone add .
git -c maintenance.auto=false -c gc.auto=0 -C new-clone commit -qm "fix spelling" 2>&1 | sed 's/^/  /'
if git -C new-clone log --oneline -1 2>/dev/null | grep -q "fix spelling"; then
    echo "  RESULT: committed - $(git -C new-clone log --oneline -1)"
else
    echo "  RESULT: could not commit"
fi

echo "  borrows the cache: $(cat new-clone/.git/objects/info/alternates 2>/dev/null | sed "s|$ROOT/||")"

if git -C new-clone push -q "$ROOT/upstream" HEAD:refs/heads/work 2>&1 | sed 's/^/  /'; then
    echo "  pushed to upstream: $(git -C upstream log --oneline work -1)"
fi

echo "  content upstream: $(git -C upstream show work:file.cs)"
