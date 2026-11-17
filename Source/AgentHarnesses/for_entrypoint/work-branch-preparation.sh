#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# fixture-requires-linux: GNU timeout bounds every git network call (neither is installed on macOS by default).
#
# The agent holds no provider credential and never touches the network (Direct DR-039), so the
# harness prepares every branch the run needs, against real repositories:
#   - DIRECT_BRANCH that already exists on the remote is continued, not recreated, so the harness's
#     never-forced push fast-forwards it - from an ordinary clone and from a stale cache mirror;
#   - DIRECT_BRANCH that does not exist starts from the default branch;
#   - DIRECT_FETCH_BRANCHES lands in refs/remotes/origin/<name>, prefix patterns included, a missing
#     name is skipped, and the default branch is always fetched;
#   - an invalid name fails with [git-config]; a restricted investigation refuses the variable.
# Assertions are single-quoted strings evaluated by check(); the extracted entrypoint code reads the
# variables set here.
# shellcheck disable=SC2016,SC2034
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
# shellcheck source=lib/scratch.sh
source "${HERE}/lib/scratch.sh"
scratch_create work-branch
ROOT="$SCRATCH_ROOT"
export HOME="$ROOT/home" GIT_CONFIG_GLOBAL="$ROOT/home/.gitconfig"
mkdir -p "$HOME"
git config --global user.name fixture
git config --global user.email fixture@localhost
git config --global init.defaultBranch main
git config --global maintenance.auto false
git config --global gc.auto 0

FAILURES=0
check() { if eval "$2"; then echo "  PASS: $1"; else echo "  FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); fi; }
log() { printf '%s\n' "$*" >> "$ROOT/messages"; }
fail() { printf '%s\n' "$*" >&2; exit 1; }
refresh_git_token() { :; }
classify_push_failure() { echo unknown; }

for function in configure_git_noninteractive git_deadline_seconds configure_git_deadline git_safe_url \
    git_timeout_detail run_git_bounded clone_failure_detail git_failure_detail start_work_branch \
    clone_into_workspace fetch_requested_branches validate_fetch_branches remember_workspace push_workspaces; do
    definition=$(awk -v name="$function" '$0 == name "() {" { take=1 } take { print } take && /^}$/ { exit }' "$ENTRYPOINT")
    [[ -n "$definition" ]] || fail "Missing ${function} in entrypoint.sh"
    eval "$definition"
done
configure_git_noninteractive
configure_git_deadline

commit() { # commit <checkout> <file> <message>
    printf '%s\n' "$3" >> "$1/$2"
    git -C "$1" add "$2"
    git -C "$1" commit -qm "$3"
}

git init -q "$ROOT/seed"
commit "$ROOT/seed" readme.md 'initial'
git -C "$ROOT/seed" branch direct/work
git -C "$ROOT/seed" checkout -q direct/work
commit "$ROOT/seed" work.md 'earlier attempt'
git -C "$ROOT/seed" checkout -q main
for branch in feature-x release/1 release/2; do git -C "$ROOT/seed" branch "$branch"; done
git clone -q --bare "$ROOT/seed" "$ROOT/upstream.git"
URL="file://$ROOT/upstream.git"
upstream() { git -C "$ROOT/upstream.git" rev-parse "$1"; }

echo '=== DIRECT_BRANCH exists on the remote: an ordinary clone continues it and the push fast-forwards ==='
WORKSPACES=()
export DIRECT_BRANCH=direct/work
unset DIRECT_REPOSITORY_CHECKOUTS DIRECT_REPOSITORY_CACHE CRATIS_WORKER_REPOSITORY_MIRRORS
clone_into_workspace "$URL" "$ROOT/existing"
check 'the checkout starts at the remote branch tip' '[[ "$(git -C "$ROOT/existing" rev-parse HEAD)" == "$(upstream direct/work)" ]]'
check 'the checked-out branch is DIRECT_BRANCH' '[[ "$(git -C "$ROOT/existing" branch --show-current)" == direct/work ]]'
push_workspaces > /dev/null 2>&1
check 'nothing committed means nothing pushed' 'grep -q "Nothing new committed in $ROOT/existing" "$ROOT/messages"'
commit "$ROOT/existing" work.md 'continued'
check 'the new commit pushes as a fast-forward' 'push_workspaces > "$ROOT/push.log" 2>&1'
check 'the remote branch carries the new commit' '[[ "$(upstream direct/work)" == "$(git -C "$ROOT/existing" rev-parse HEAD)" ]]'

echo '=== DIRECT_BRANCH absent on the remote: the checkout starts from the default branch ==='
WORKSPACES=()
export DIRECT_BRANCH=direct/new
clone_into_workspace "$URL" "$ROOT/absent"
check 'the checkout starts at the default branch' '[[ "$(git -C "$ROOT/absent" rev-parse HEAD)" == "$(upstream main)" ]]'
check 'the absence is logged' 'grep -q "direct/new does not exist on" "$ROOT/messages"'
commit "$ROOT/absent" new.md 'new work'
check 'the first push creates the branch' 'push_workspaces > "$ROOT/push.log" 2>&1 && [[ "$(upstream direct/new)" == "$(git -C "$ROOT/absent" rev-parse HEAD)" ]]'

echo '=== DIRECT_BRANCH from a stale cache mirror: the remote tip wins over the mirror copy ==='
git clone -q --mirror "$ROOT/upstream.git" "$ROOT/cache.git"
git clone -q "$URL" "$ROOT/elsewhere"
git -C "$ROOT/elsewhere" checkout -q direct/work
commit "$ROOT/elsewhere" work.md 'pushed after the mirror refreshed'
git -C "$ROOT/elsewhere" push -q origin direct/work
WORKSPACES=()
export DIRECT_BRANCH=direct/work
export DIRECT_REPOSITORY_CACHE="$ROOT" CRATIS_WORKER_REPOSITORY_MIRRORS="${URL}"$'\t'"$ROOT/cache.git"
clone_into_workspace "$URL" "$ROOT/cached"
check 'the cached checkout came from the mirror' 'grep -q "Using the cached clone" "$ROOT/messages"'
check 'the cached checkout starts at the remote tip, not the mirror' '[[ "$(git -C "$ROOT/cached" rev-parse HEAD)" == "$(upstream direct/work)" && "$(git -C "$ROOT/cache.git" rev-parse direct/work)" != "$(upstream direct/work)" ]]'
commit "$ROOT/cached" work.md 'continued from the cache'
check 'the cached checkout pushes as a fast-forward' 'push_workspaces > "$ROOT/push.log" 2>&1 && [[ "$(upstream direct/work)" == "$(git -C "$ROOT/cached" rev-parse HEAD)" ]]'
unset DIRECT_REPOSITORY_CACHE CRATIS_WORKER_REPOSITORY_MIRRORS

echo '=== DIRECT_FETCH_BRANCHES lands in refs/remotes/origin, patterns included, missing names skipped ==='
WORKSPACES=()
export DIRECT_BRANCH=direct/fetching
clone_into_workspace "$URL" "$ROOT/fetching"
# Everything below happens after the clone, so only the harness's own fetch can bring it in.
git -C "$ROOT/elsewhere" checkout -q main
commit "$ROOT/elsewhere" readme.md 'main moved on'
git -C "$ROOT/elsewhere" push -q origin main
for branch in release/3 unrequested; do git -C "$ROOT/elsewhere" push -q origin "main:refs/heads/${branch}"; done
export DIRECT_FETCH_BRANCHES='feature-x release/* missing nope-*'
validate_fetch_branches
fetch_requested_branches
tracking() { git -C "$ROOT/fetching" rev-parse --verify --quiet "refs/remotes/origin/$1" 2>/dev/null; }
check 'the default branch is fetched' '[[ "$(tracking main)" == "$(upstream main)" ]]'
check 'an exact name is fetched' '[[ "$(tracking feature-x)" == "$(upstream feature-x)" ]]'
check 'a prefix pattern fetches new branches under it' '[[ "$(tracking release/3)" == "$(upstream release/3)" ]]'
check 'an unrequested branch is not fetched' '[[ -z "$(tracking unrequested)" ]]'
check 'a missing name is logged and skipped' 'grep -q "No branch matches missing on" "$ROOT/messages" && grep -q "No branch matches nope-\* on" "$ROOT/messages"'
check 'the work branch is untouched' '[[ "$(git -C "$ROOT/fetching" branch --show-current)" == direct/fetching ]]'
check 'origin/main merges locally' 'git -C "$ROOT/fetching" merge -q --no-edit origin/main > /dev/null 2>&1'

echo '=== Invalid names fail with [git-config] ==='
for value in 'a..b' '-x' 'x/' '*' 'a**' $'a\tb' $'a\nb' 'a.lock' 'a@{b' 'a b..c'; do
    if ( DIRECT_FETCH_BRANCHES="$value" validate_fetch_branches ) > "$ROOT/error" 2>&1; then
        check "'${value}' is refused" false
    else
        check "'${value//$'\n'/\\n}' is refused with [git-config]" 'grep -q "^\[git-config\]" "$ROOT/error"'
    fi
done
check 'an empty value requests nothing' '( DIRECT_FETCH_BRANCHES="" validate_fetch_branches; [[ ${#FETCH_BRANCHES[@]} -eq 0 ]] ) > /dev/null 2>&1'

echo '=== A restricted investigation refuses DIRECT_FETCH_BRANCHES ==='
block=$(awk '/^if \[\[ -n "\$\{DIRECT_REPOSITORY_CHECKOUTS:-\}" \]\]; then$/ { take=1 } take && /^elif / { exit } take { print }' "$ENTRYPOINT")
[[ -n "$block" ]] || fail 'restricted credential block not found'
for value in '' main; do
    if ( export DIRECT_REPOSITORY_CHECKOUTS='[]' DIRECT_CLONE_CREDENTIALS='[]' DIRECT_FETCH_BRANCHES="$value"; unset GITHUB_TOKEN GH_TOKEN DIRECT_PUSH_TOKEN_URL; eval "${block}
fi" ) > "$ROOT/error" 2>&1; then
        check "restricted checkout refuses DIRECT_FETCH_BRANCHES='${value}'" false
    else
        check "restricted checkout refuses DIRECT_FETCH_BRANCHES='${value}'" 'grep -q "Restricted checkout refuses DIRECT_FETCH_BRANCHES" "$ROOT/error"'
    fi
done

if [[ $FAILURES -ne 0 ]]; then
    echo "work branch preparation: ${FAILURES} failure(s)" >&2
    cat "$ROOT/messages" >&2
    exit 1
fi
echo 'work branch preparation: existing branches continue, requested branches fetch, invalid names fail'
