#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# Exercise the entrypoint's real push and termination functions without starting an agent or
# contacting Direct/GitHub. The stubs record only token freshness, never token values in logs.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
entrypoint="$here/../entrypoint.sh"
awk '/^refresh_git_token\(\)/ { take=1 } take { print } take && /^}$/ { if (++closed == 2) exit }' "$entrypoint" > "$root/functions"
awk '/^on_termination\(\)/ { take=1 } take { print } take && /^}$/ { exit }' "$entrypoint" >> "$root/functions"
awk '/^on_exit\(\)/ { take=1 } take { print } take && /^}$/ { exit }' "$entrypoint" >> "$root/functions"
[[ $(grep -c '^}\s*$' "$root/functions") -eq 4 ]] || { echo 'Could not lift entrypoint functions'; exit 2; }
mkdir "$root/bin"
cat > "$root/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALLS"
[[ "$*" == *"Authorization: Bearer callback-secret"* ]] || exit 1
[[ "$*" == *"-X POST"* && "$*" == *"/api/work/42/push-token"* ]] || exit 1
case "$MODE" in
    unavailable) exit 22 ;;
    empty) exit 0 ;;
    *) printf '{"token":"fresh-token"}\n' ;;
esac
STUB
cat > "$root/bin/git" <<'STUB'
#!/usr/bin/env bash
case "$*" in
    *'rev-parse HEAD'*) echo new-head ;;
    *'push '*)
        printf 'push:%s\n' "${GITHUB_TOKEN:-}" >> "$CALLS"
        [[ "$MODE" != push-fails && "${GITHUB_TOKEN:-}" == fresh-token ]]
        ;;
    *'config --global credential.helper'*) exit 0 ;;
    *) exit 2 ;;
esac
STUB
chmod +x "$root/bin/"*
export PATH="$root/bin:$PATH" CALLS="$root/calls"
export DIRECT_BRANCH=direct/spec DIRECT_PUSH_TOKEN_URL=https://direct.example/api/work/42/push-token
export DIRECT_CALLBACK_TOKEN=callback-secret GITHUB_TOKEN=expired-token
log() { :; }
stop_pipe_holder() { :; }
# shellcheck source=/dev/null
. "$root/functions"
failures=0
check() {
    local label="$1"
    shift
    if ! "$@"; then echo "FAIL: $label"; failures=$((failures + 1)); fi
}
has_fresh_push() { grep -q '^push:fresh-token$' "$CALLS"; }
no_push() { ! grep -q '^push:' "$CALLS"; }
no_requests() { [[ ! -s "$CALLS" ]]; }
head_acknowledged() { [[ "${WORKSPACES[0]}" == *'|new-head|'* ]]; }
head_pending() { [[ "${WORKSPACES[0]}" == *'|old-head|'* ]]; }
status_is() { [[ "$1" -eq "$2" ]]; }
for mode in success unavailable empty push-fails; do
    MODE="$mode"; export MODE
    : > "$CALLS"
    WORKSPACES=("$root/repo|old-head|https://github.example/repo.git")
    if push_workspaces; then result=0; else result=1; fi
    if [[ "$mode" == success ]]; then
        check 'fresh token was used' has_fresh_push
        check 'head was acknowledged' head_acknowledged
        check 'success returned zero' status_is "$result" 0
    else
        check "$mode fails closed" status_is "$result" 1
        check "$mode does not acknowledge head" head_pending
        if [[ "$mode" != push-fails ]]; then
            check "$mode does not push with expired credential" no_push
        fi
    fi
done
MODE=success; export MODE
DIRECT_PUSH_TOKEN_URL=''
WORKSPACES=("$root/repo|old-head|https://github.example/repo.git")
: > "$CALLS"
if push_workspaces; then result=0; else result=1; fi
check 'invalid push-token URL fails closed' status_is "$result" 1
check 'invalid push-token URL makes no token request or push' no_requests
DIRECT_PUSH_TOKEN_URL=https://direct.example/api/work/42/push-token
# Signal and EXIT paths call the same real push, even after an unsuccessful attempt.
for signal in TERM INT; do
    MODE=success; export MODE
    : > "$CALLS"
    WORKSPACES=("$root/repo|old-head|https://github.example/repo.git")
    export AGENT_PID='' HEADROOM_PID=''
    ( on_termination "$signal" "$([[ "$signal" == TERM ]] && echo 15 || echo 2)" ) >/dev/null 2>&1
    status=$?
    check "$signal exits with signal status" status_is "$status" "$((128 + ($([[ "$signal" == TERM ]] && echo 15 || echo 2))))"
    check "$signal preserves commits" has_fresh_push
done
MODE=push-fails; export MODE
WORKSPACES=("$root/repo|old-head|https://github.example/repo.git")
( on_exit 0 ) >/dev/null 2>&1
status=$?
check 'EXIT fails on push error' status_is "$status" 1
echo "Checked 5 push outcomes and 3 exit paths; failures: $failures"
(( failures == 0 ))
