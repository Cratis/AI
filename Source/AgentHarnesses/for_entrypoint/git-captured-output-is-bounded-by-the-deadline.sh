#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# fixture-requires-linux: GNU timeout and process-group semantics.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(mktemp -d)"
exec 9> "$root/trace"
BASH_XTRACEFD=9
cleanup() {
    local status=$? pid
    if [[ $status -ne 0 ]]; then
        echo "Failed (exit $status); last traced commands:" >&2
        tail -n 40 "$root/trace" >&2
        if [[ -f "$root/error" ]]; then cat "$root/error" >&2; fi
    fi
    if [[ -f "$root/pids" ]]; then
        while read -r pid; do
            kill "$pid" 2>/dev/null || :
        done < "$root/pids"
    fi
    rm -rf "$root"
}
trap cleanup EXIT
set -x
entrypoint="${ENTRYPOINT_UNDER_TEST:-$here/../entrypoint.sh}"
for function in configure_git_noninteractive git_deadline_seconds configure_git_deadline git_safe_url git_timeout_detail run_git_bounded clone_failure_detail clone_into_workspace; do
    awk -v name="$function" '$0 == name "() {" { take=1 } take { print } take && /^}$/ { exit }' "$entrypoint" >> "$root/functions"
done
[[ $(grep -c '^}$' "$root/functions") -eq 8 ]] || { echo 'Missing bounded-git functions'; exit 1; }
mkdir -p "$root/bin" "$root/cache/o/r.git" "$root/captures"
cat > "$root/bin/git" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALLS"
[[ "$GIT_TERMINAL_PROMPT" == 0 && ${GIT_ASKPASS+x} && -z "$GIT_ASKPASS" && ${SSH_ASKPASS+x} && -z "$SSH_ASKPASS" && -z ${SSH_ASKPASS_REQUIRE+x} && "$GCM_INTERACTIVE" == never && "$GIT_SSH_COMMAND" == *BatchMode=yes* ]] || exit 90
case "$MODE:$*" in
    leaky-ls-remote:ls-remote\ *)
        # Job control gives this helper its own process group, outside timeout's signals.
        # It inherits stdout and outlives the git stub even after the kill-after grace.
        set -m
        sleep 60 &
        printf '%s\n' "$!" >> "$PIDS"
        set +m
        trap '' TERM
        wait
        ;;
    success:ls-remote\ *) printf 'ref: refs/heads/main\tHEAD\n' ;;
esac
STUB
chmod +x "$root/bin/git"
cat > "$root/scenario" <<'SCENARIO'
set -euo pipefail
log() { printf '%s\n' "$*" >&2; }
fail() { printf '%s\n' "$*" >&2; exit 1; }
remember_workspace() { :; }
# shellcheck source=/dev/null
. "$root/functions"
configure_git_noninteractive
configure_git_deadline
clone_into_workspace https://github.com/o/r.git "$root/$MODE"
SCENARIO
export root PATH="$root/bin:$PATH" CALLS="$root/calls" PIDS="$root/pids" TMPDIR="$root/captures"
export DIRECT_REPOSITORY_CACHE="$root/cache" DIRECT_BRANCH=direct/spec CRATIS_GIT_DEADLINE_SECONDS=1
# shellcheck source=/dev/null
. "$root/functions"
fail() { printf '%s\n' "$*" >&2; exit 1; }
configure_git_deadline
start=$SECONDS
status=0
MODE=leaky-ls-remote "$GIT_TIMEOUT_BIN" --kill-after=2 20 bash "$root/scenario" > "$root/error" 2>&1 || status=$?
elapsed=$((SECONDS - start))
echo "captured ls-remote: status=$status elapsed=${elapsed}s"
[[ $status -eq 1 && $elapsed -lt 20 ]]
grep -q '^\[git-timeout\] git ls-remote https://github.com/o/r.git exceeded the 1s deadline' "$root/error"
# Prove that the helper actually survived; otherwise a passing test would not exercise the pipe leak.
read -r helper < "$PIDS"
kill -0 "$helper"
[[ -z $(ls -A "$root/captures") ]]
MODE=success bash "$root/scenario"
grep -Fxq -- "-C $root/success fetch --quiet https://github.com/o/r.git refs/heads/main" "$CALLS"
grep -Fxq -- "-C $root/success checkout -qB direct/spec FETCH_HEAD" "$CALLS"
[[ -z $(ls -A "$root/captures") ]]
echo 'captured git output: surviving helper is bounded, capture files are removed and default branch is preserved'
