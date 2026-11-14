#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
ROOT="$(mktemp -d "${TMPDIR:-/tmp}/entrypoint-cache.XXXXXX")"
trap 'rm -rf -- "$ROOT"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
log() { :; }
remember_workspace() { :; }
run_git_bounded() { shift; git "$@"; }
clone_failure_detail() { echo failed; }
git_timeout_detail() { echo timed-out; }
git() {
    if [[ "$1" == -c ]]; then command git "$@"; return; fi
    printf '%s\n' "$*" >> "$ROOT/calls"
}
mkdir -p "$ROOT/cache/git.example/owner/empty.git" "$ROOT/cache/git.example/owner/invalid.git/objects" "$ROOT/cache/git.example/owner/invalid.git/refs"
touch "$ROOT/cache/git.example/owner/invalid.git/HEAD"
command git init --bare --initial-branch=main "$ROOT/cache/git.example/owner/repo.git" >/dev/null
# An old-layout mirror must not be selected when the exact mapping is absent.
command git init --bare --initial-branch=main "$ROOT/cache/owner/repo.git" >/dev/null
sed -n '/^clone_into_workspace() {/,/^}/p' "$ENTRYPOINT" > "$ROOT/clone.sh"
# shellcheck source=/dev/null
source "$ROOT/clone.sh"
DIRECT_REPOSITORY_CACHE="$ROOT/cache"
export DIRECT_REPOSITORY_CACHE
url=https://git.example/owner/repo.git
mirror="$ROOT/cache/git.example/owner/repo.git"
CRATIS_WORKER_REPOSITORY_MIRRORS="${url}"$'\t'"${mirror}"
clone_into_workspace "$url" "$ROOT/exact"
grep -q -- "--shared $mirror" "$ROOT/calls" || fail 'exact mapping did not select its mirror'
for near in https://GIT.example/owner/repo.git https://git.example/owner/repo.git/ https://git.example/owner/repo https://git.example/Owner/repo.git; do
    : > "$ROOT/calls"
    clone_into_workspace "$near" "$ROOT/near"
    grep -q '^clone https://' "$ROOT/calls" || fail 'near-miss URL did not use network cloning'
    ! grep -q -- '--shared' "$ROOT/calls" || fail 'near-miss URL selected a mirror'
done
for mode in empty unset invalid empty-directory; do
    case "$mode" in
        empty) CRATIS_WORKER_REPOSITORY_MIRRORS='' ;;
        unset) unset CRATIS_WORKER_REPOSITORY_MIRRORS ;;
        invalid) CRATIS_WORKER_REPOSITORY_MIRRORS="${url}"$'\t'"$ROOT/cache/git.example/owner/invalid.git" ;;
        empty-directory) CRATIS_WORKER_REPOSITORY_MIRRORS="${url}"$'\t'"$ROOT/cache/git.example/owner/empty.git" ;;
    esac
    : > "$ROOT/calls"
    clone_into_workspace "$url" "$ROOT/$mode"
    grep -q "^clone $url " "$ROOT/calls" || fail "$mode mapping did not use network cloning"
    ! grep -q -- '--shared' "$ROOT/calls" || fail "$mode mapping selected a mirror"
done
echo 'PASS: only exact URL mappings to valid bare mirrors use shared cloning'
