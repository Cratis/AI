#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# Empty cache subdirectories use normal cloning; populated bare mirrors retain shared cloning.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/scratch.sh
source "${HERE}/lib/scratch.sh"
scratch_create empty-cache-directory
ROOT="$SCRATCH_ROOT"
ENTRYPOINT="$(cd "${HERE}/.." && pwd)/entrypoint.sh"
fail() { echo "FAIL: $*" >&2; exit 1; }
log() { :; }
remember_workspace() { :; }
git_safe_url() { printf '%s' "$1"; }
run_git_bounded() { shift; git "$@"; }
git() { printf '%s\n' "$*" >> "$ROOT/calls"; }
mkdir -p "$ROOT/cache/owner/repo.git" "$ROOT/cache/owner/mirror.git/objects" "$ROOT/cache/owner/mirror.git/refs"
touch "$ROOT/cache/owner/mirror.git/HEAD"
# Execute the actual entrypoint function, with bounded git calls recorded rather than networked.
sed -n '/^clone_into_workspace() {/,/^}/p' "$ENTRYPOINT" > "$ROOT/clone.sh"
[[ -s "$ROOT/clone.sh" ]] || fail 'clone function was not extracted'
# shellcheck source=/dev/null
source "$ROOT/clone.sh"
DIRECT_REPOSITORY_CACHE="$ROOT/cache"
DIRECT_BRANCH=""
clone_into_workspace https://github.com/owner/repo.git "$ROOT/checkout"
grep -q '^clone https://github.com/owner/repo.git ' "$ROOT/calls" || fail 'normal clone was not used'
! grep -q -- '--shared' "$ROOT/calls" || fail 'empty directory was treated as a mirror'
clone_into_workspace https://github.com/owner/mirror.git "$ROOT/shared-checkout"
grep -q '^clone --shared ' "$ROOT/calls" || fail 'populated mirror did not use shared cloning'
echo 'PASS: empty cache directories use normal cloning; populated mirrors use shared cloning'
