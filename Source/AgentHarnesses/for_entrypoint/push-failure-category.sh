#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# shellcheck source-path=SCRIPTDIR
# Exercises the real classifier, push and callback functions lifted verbatim from entrypoint.sh.
# No full entrypoint or fixed /tmp paths: runs concurrently on macOS and Linux. A local bare
# remote rejects a real push; only curl (callback transport) and token refresh are stubbed.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
# The shared scratch helper is not part of this fixture's ShellCheck input.
# shellcheck source=/dev/null
source "${HERE}/lib/scratch.sh"
scratch_create push-failure
ROOT="$SCRATCH_ROOT"
mkdir -p "$ROOT/home" "$ROOT/tmp"
export HOME="$ROOT/home" TMPDIR="$ROOT/tmp" GIT_CONFIG_NOSYSTEM=1

lift() {
    awk -v name="$1" '$0 ~ "^" name "\\(\\)" { inside = 1 } inside { print } inside && /^}$/ { exit }' "$ENTRYPOINT"
}
for function_name in classify_push_failure remember_workspace push_workspaces report; do
    lift "$function_name" >> "$ROOT/functions.sh"
    grep -q "^${function_name}()" "$ROOT/functions.sh" || { echo "FAILED to lift $function_name"; exit 1; }
done
# shellcheck source=../entrypoint.sh
source "$ROOT/functions.sh"

check() {
    local description="$1" expected="$2" actual="$3"
    if [[ "$expected" != "$actual" ]]; then
        echo "FAIL: $description" >&2
        exit 1
    fi
    echo "PASS: $description"
}
classifies() {
    check "$1" "$1" "$(printf '%s\n' "$2" | classify_push_failure)"
}

classifies rejected-permission "fatal: unable to access 'https://github.com/o/r.git/': The requested URL returned error: 403"
classifies rejected-permission 'remote: Permission to o/r.git denied to worker.'
classifies rejected-permission 'fatal: permission denied'
classifies rejected-permission 'remote: Write access to repository not granted.'
classifies rejected-non-fast-forward ' ! [rejected] HEAD -> work (non-fast-forward)'
classifies rejected-non-fast-forward ' ! [rejected] HEAD -> work (fetch first)'
classifies rejected-non-fast-forward ' ! [rejected] HEAD -> work (stale info)'
classifies rejected-hook ' ! [remote rejected] HEAD -> work (pre-receive hook declined)'
classifies rejected-hook ' ! [remote rejected] HEAD -> work (custom hook refused)'
classifies rejected-hook 'remote: protected branch hook declined'
classifies rejected-hook 'remote: error: GH006: Protected branch update failed'
classifies rejected-hook 'remote: error: GH013: Repository rule violations found'
classifies auth-failed "fatal: unable to access 'https://github.com/o/r.git/': Authentication failed (401)"
classifies auth-failed "fatal: could not read Username for 'https://github.com': No such device or address"
classifies auth-failed 'remote: Invalid username or password'
classifies auth-failed 'HTTP 401'
classifies network 'fatal: Could not resolve host: github.com'
classifies network 'fatal: Connection timed out'
classifies network 'fatal: Connection refused'
classifies network 'fatal: Failed to connect to github.com'
classifies network 'error: RPC failed; curl 56 receive failure'
classifies network 'fatal: early EOF'
classifies network "fatal: unable to access 'https://github.com/o/r.git/'"
classifies unknown 'fatal: unexpected local push failure'
classifies unknown 'non-fast-forward without a rejection marker'
classifies unknown ''
# Explicit precedence when generic transport errors and several specific markers coexist.
classifies rejected-permission $'HTTP 403\nAuthentication failed\nGH013\nRPC failed'
classifies auth-failed $'HTTP 401\nGH013\nRPC failed'
classifies rejected-hook $'GH013\n[rejected] non-fast-forward\nRPC failed'
classifies rejected-non-fast-forward $'[rejected] fetch first\nRPC failed'

# The callback stub never contacts a service, even if the fixture inherits dispatch variables.
DIRECT_CALLBACK_URL='https://callback.invalid/result'
DIRECT_CALLBACK_TOKEN=''
DIRECT_RUN_MODE=''
DIRECT_REPOSITORY_CHECKOUTS=''
DIRECT_BRANCH='fixture-push-failure'
PUSH_FAILURE_CATEGORY=''
WORKSPACES=()
CALLBACK="$ROOT/callback.json"
curl() { cat > "$CALLBACK"; }
log() { printf '%s\n' "$*" >&2; }
refresh_git_token() { return 0; }

ORIGINAL='{"status":"failed","detail":"Could not push committed work","inputTokens":0,"outputTokens":0,"costUsd":0,"durationMs":0,"cpuSeconds":0,"memoryBytes":0}'
report failed 'Could not push committed work'
check 'no push failure keeps the exact original callback bytes' "$ORIGINAL" "$(cat "$CALLBACK")"

# A real rejecting remote emits intentionally hostile, entirely synthetic diagnostics.
git init -q --bare "$ROOT/upstream.git"
git init -q "$ROOT/checkout"
git -C "$ROOT/checkout" config user.email fixture@example.invalid
git -C "$ROOT/checkout" config user.name fixture
printf 'initial\n' > "$ROOT/checkout/file"
git -C "$ROOT/checkout" add file
git -c maintenance.auto=false -c gc.auto=0 -C "$ROOT/checkout" commit -qm initial
remember_workspace "$ROOT/checkout" "$ROOT/upstream.git"
printf 'committed work\n' >> "$ROOT/checkout/file"
git -c maintenance.auto=false -c gc.auto=0 -C "$ROOT/checkout" commit -qam work
cat > "$ROOT/upstream.git/hooks/pre-receive" <<'HOOK'
#!/bin/sh
printf '%s\n' 'HOSTILE: https://x-access-token:SECRET123@github.com/o/r.git' 'ghp_fixture_token_not_a_real_credential_123456789' >&2
exit 1
HOOK
chmod +x "$ROOT/upstream.git/hooks/pre-receive"
# The second workspace fails differently (unknown), proving the first failure is retained.
remember_workspace "$ROOT/checkout" "$ROOT/missing.git"
WORKSPACES[1]="$ROOT/checkout|initial|$ROOT/missing.git"
if push_workspaces > "$ROOT/push.stdout" 2> "$ROOT/push.stderr"; then
    echo 'FAIL: the rejecting remote accepted the push' >&2
    exit 1
fi
check 'first failed workspace wins' rejected-hook "$PUSH_FAILURE_CATEGORY"
grep -q 'pre-receive hook declined' "$ROOT/push.stderr"
grep -q 'SECRET123' "$ROOT/push.stderr"
grep -q 'ghp_fixture_token' "$ROOT/push.stderr"
check 'private stderr files are removed' '' "$(find "$TMPDIR" -name 'push-stderr.*' -print)"
report failed 'Could not push committed work'
jq -e --argjson original "$ORIGINAL" '
    .pushFailure == {category: "rejected-hook"}
    and (.pushFailure | keys) == ["category"]
    and (del(.pushFailure) == $original)
    and (keys == (($original | keys) + ["pushFailure"] | sort))
' "$CALLBACK" > /dev/null
if grep -Eq 'SECRET123|x-access-token|ghp_fixture_token|HOSTILE|pre-receive hook declined|remote:|fatal:' "$CALLBACK"; then
    echo 'FAIL: push stderr leaked into the callback' >&2
    exit 1
fi
echo 'PASS: real rejected push reports only the category, never hostile stderr'

refresh_git_token() { return 1; }
if push_workspaces > "$ROOT/refresh.stdout" 2> "$ROOT/refresh.stderr"; then exit 1; fi
check 'later refresh failure preserves first category' rejected-hook "$PUSH_FAILURE_CATEGORY"
PUSH_FAILURE_CATEGORY=''
if push_workspaces > "$ROOT/refresh.stdout" 2> "$ROOT/refresh.stderr"; then exit 1; fi
check 'token refresh failure is auth-failed' auth-failed "$PUSH_FAILURE_CATEGORY"
report failed 'Could not push committed work'
jq -e '.pushFailure == {category: "auth-failed"}' "$CALLBACK" > /dev/null

# Only the closed list is ever sent, even if a caller puts hostile text in the global.
PUSH_FAILURE_CATEGORY=$'unexpected\nSECRET123 https://x-access-token:fake@github.com/o/r.git'
report failed 'Could not push committed work'
jq -e '.pushFailure == {category: "unknown"}' "$CALLBACK" > /dev/null
if grep -Eq 'SECRET123|x-access-token|unexpected' "$CALLBACK"; then exit 1; fi
echo 'PASS: invalid categories become unknown'
report completed 'finished'
jq -e 'has("pushFailure") | not' "$CALLBACK" > /dev/null
PUSH_FAILURE_CATEGORY='network'
report failed 'Could not push committed work' 0 0 0 0 0 0 quotaExhausted example model code
jq -e '.pushFailure == {category: "network"} and .reason == "quotaExhausted" and .provider == "example" and .model == "model" and .vendorCode == "code"' "$CALLBACK" > /dev/null
echo 'PASS: category is failed-only and preserves optional reason fields'

# A subsequent real successful push leaves both the category and callback shape untouched.
PUSH_FAILURE_CATEGORY=''
refresh_git_token() { return 0; }
printf '#!/bin/sh\nexit 0\n' > "$ROOT/upstream.git/hooks/pre-receive"
WORKSPACES=("${WORKSPACES[0]}")
push_workspaces > "$ROOT/success.stdout" 2> "$ROOT/success.stderr"
check 'successful push records no failure' '' "$PUSH_FAILURE_CATEGORY"
report failed 'Could not push committed work'
check 'successful push keeps the exact original callback bytes' "$ORIGINAL" "$(cat "$CALLBACK")"
check 'private stderr files removed after success too' '' "$(find "$TMPDIR" -name 'push-stderr.*' -print)"
