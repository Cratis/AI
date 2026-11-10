#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# fixture-requires-linux: GNU timeout (neither timeout nor gtimeout is installed on macOS).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(mktemp -d)"
# Every assertion is a bare test, so a failure would otherwise exit silently: trace to a file
# and show its tail when the fixture fails.
exec 9> "$root/trace"
BASH_XTRACEFD=9
trap 'status=$?; if [[ $status -ne 0 ]]; then echo "Failed (exit $status); last traced commands:" >&2; tail -n 40 "$root/trace" >&2; fi; rm -rf "$root"' EXIT
set -x
entrypoint="$here/../entrypoint.sh"
for function in configure_git_noninteractive git_deadline_seconds configure_git_deadline git_safe_url git_timeout_detail run_git_bounded clone_failure_detail clone_into_workspace; do
    awk -v name="$function" '$0 == name "() {" { take=1 } take { print } take && /^}$/ { exit }' "$entrypoint" >> "$root/functions"
done
[[ $(grep -c '^}$' "$root/functions") -eq 8 ]] || { echo 'Missing bounded-git functions'; exit 1; }
mkdir "$root/bin"
cat > "$root/bin/git" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALLS"
[[ "$GIT_TERMINAL_PROMPT" == 0 && ${GIT_ASKPASS+x} && -z "$GIT_ASKPASS" && ${SSH_ASKPASS+x} && -z "$SSH_ASKPASS" && -z ${SSH_ASKPASS_REQUIRE+x} && "$GCM_INTERACTIVE" == never && "$GIT_SSH_COMMAND" == *BatchMode=yes* ]] || exit 90
case "$MODE:$*" in
    # exec: one stubborn process that ignores TERM. A child sleep would outlive the KILL on runners
    # where timeout signals only its direct child, and hold the caller's output pipe open.
    sleep:*) trap '' TERM; exec sleep 30 ;;
    kill-early:*) exit 137 ;;
    auth:*) echo 'fatal: could not read Username: terminal prompts disabled' >&2; read -r ignored || :; exit 128 ;;
    remote-fails:*ls-remote*) exit 128 ;;
    remote-timeout:*ls-remote*) exit 124 ;;
    fetch-timeout:*ls-remote*) printf 'ref: refs/heads/main\tHEAD\n' ;;
    fetch-timeout:*' fetch '*) exit 124 ;;
    *) exit 0 ;;
esac
STUB
chmod +x "$root/bin/git"
export PATH="$root/bin:$PATH" CALLS="$root/calls" MODE=success
log() { printf '%s\n' "$*" >&2; }
fail() { printf '%s\n' "$*" >&2; exit 1; }
remember_workspace() { :; }
# shellcheck source=/dev/null
. "$root/functions"
export GIT_TERMINAL_PROMPT=1 GIT_ASKPASS=/bin/evil SSH_ASKPASS=/bin/evil SSH_ASKPASS_REQUIRE=force GIT_SSH_COMMAND=ssh
configure_git_noninteractive
unset CRATIS_GIT_DEADLINE_SECONDS
[[ $(git_deadline_seconds) == 600 ]]
CRATIS_GIT_DEADLINE_SECONDS=''; [[ $(git_deadline_seconds) == 600 ]]
for value in abc 0 -5 1e3 3601 99999 ' 5'; do
    if ( CRATIS_GIT_DEADLINE_SECONDS="$value" git_deadline_seconds ) > "$root/error" 2>&1; then exit 1; fi
    grep -q '^\[git-config\]' "$root/error"
done
export CRATIS_GIT_DEADLINE_SECONDS=1
configure_git_deadline
run_git_bounded clone clone https://github.com/o/r.git "$root/repo"
user=user; password=FAKEPW; scheme=https; host=github.com/o/r.git
url="${scheme}://${user}:${password}@${host}"
for command in clone fetch ls-remote; do
    # The stubborn clone exercises kill-after; the other commands exercise TERM and substitution.
    MODE='sleep'; export MODE
    start=$SECONDS
    if output=$(run_git_bounded "$command" "$command" "$url" 2> "$root/error"); then exit 1; else status=$?; fi
    [[ $status -eq 124 && $((SECONDS - start)) -le 15 ]]
    detail="$(git_timeout_detail "$command" "$url")"
    [[ "$detail" == "[git-timeout] git $command https://github.com/o/r.git exceeded the 1s deadline (CRATIS_GIT_DEADLINE_SECONDS) and was stopped" ]]
    if grep -q "$password" "$root/error"; then exit 1; fi
    [[ "$output$detail" != *"$password"* ]]
done
MODE=kill-early; export MODE
if GIT_DEADLINE_SECONDS=30 run_git_bounded clone clone "$url" 2> "$root/error"; then exit 1; else [[ $? -eq 137 ]]; fi
if grep -q 'exceeded' "$root/error"; then exit 1; fi
if ( DIRECT_REPOSITORY_CACHE='' GIT_DEADLINE_SECONDS=30 clone_into_workspace "$url" "$root/killed" ) > "$root/error" 2>&1; then exit 1; fi
grep -q '^Could not clone https://github.com/o/r.git' "$root/error"
if grep -q '\[git-timeout\]' "$root/error"; then exit 1; fi
MODE=auth; export MODE
if run_git_bounded clone clone "$url" < /dev/zero 2> "$root/error"; then exit 1; else [[ $? -eq 128 ]]; fi
grep -q 'needs a credential but none is available' "$root/error"
[[ $(clone_failure_detail "$url") == '[git-auth] Could not clone https://github.com/o/r.git: no usable credential (terminal prompts are disabled)' ]]
# Missing timeout fails before git can start; builtins still work with an empty PATH.
: > "$CALLS"
if ( export PATH="$root/empty"; configure_git_deadline ) > "$root/error" 2>&1; then exit 1; fi
grep -q '^\[git-config\]' "$root/error"
[[ ! -s "$CALLS" ]]
mkdir -p "$root/cache/o/r.git"
export DIRECT_REPOSITORY_CACHE="$root/cache" DIRECT_BRANCH=direct/spec
MODE=remote-fails; export MODE
clone_into_workspace https://github.com/o/r.git "$root/checkout"
MODE=remote-timeout; export MODE
if ( clone_into_workspace https://github.com/o/r.git "$root/other" ) > "$root/error" 2>&1; then exit 1; fi
grep -q '^\[git-timeout\] git ls-remote' "$root/error"
MODE=fetch-timeout; export MODE
if ( clone_into_workspace https://github.com/o/r.git "$root/stalled" ) > "$root/error" 2>&1; then exit 1; fi
grep -q '^\[git-timeout\] git fetch' "$root/error"
echo 'bounded git: environment, deadlines, authentication, redaction and cache fallback checked'
