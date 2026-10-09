#!/usr/bin/env bash
# A session the provider turned away because its quota, spend limit or credit is used up reports a
# typed failure - the failed callback carries reason "quotaExhausted", with the provider, model and
# vendor error code where known - so the dispatching product can continue the work on another
# provider (Cratis/AI#423). Any other failure reports the failed callback exactly as before, with no
# reason field at all.
#
# Runs the real entrypoint.sh, not a reimplementation. The only things changed are the hardcoded
# /workspace path, which has to move somewhere writable outside a container, and stubs on PATH
# standing in for the agent CLI, rtk and curl - the curl stub records every callback payload so the
# spec can read what the dispatcher would have received. It runs under `env -i` so a leaked
# DIRECT_CALLBACK_URL cannot report a spec run to a real Direct.
#
# Needs bash >= 4.4 and GNU date, so it is a Linux spec - see pi-worker-pushes-commits.sh for why.
#
# Exits non-zero when the behavior is not in effect.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
# shellcheck source=lib/scratch.sh
source "${HERE}/lib/scratch.sh"
scratch_create quotatest
ROOT="$SCRATCH_ROOT"

BRANCH="direct/spec-quota"
CREDENTIAL='{"type":"oauth","access":"tok","refresh":"rt","expires":4102444800000,"accountId":"acct-1"}'
FAILURES=0

git init -q --bare -b main "$ROOT/upstream.git"
git init -q -b main "$ROOT/seed"
git -C "$ROOT/seed" config user.email a@b.c; git -C "$ROOT/seed" config user.name t
echo "real behavior lives here" > "$ROOT/seed/file.cs"
git -C "$ROOT/seed" add .; git -c maintenance.auto=false -c gc.auto=0 -C "$ROOT/seed" commit -qm init
git -C "$ROOT/seed" push -q "$ROOT/upstream.git" HEAD:refs/heads/main

mkdir -p "$ROOT/bin"
printf '#!/bin/sh\nexit 0\n' > "$ROOT/bin/rtk"

# Every callback's JSON body arrives on stdin (`-d @-`); one line per callback.
cat > "$ROOT/bin/curl" <<STUB
#!/usr/bin/env bash
case "\$*" in
    *'/api/work/spec/callback'*) cat >> "$ROOT/callbacks.jsonl"; printf '\n' >> "$ROOT/callbacks.jsonl" ;;
    *) exit 0 ;;
esac
STUB

# Claude Code ends a session the API refused over a spent spend limit with an errored result event.
cat > "$ROOT/bin/claude-out-of-quota" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' '{"type":"result","subtype":"success","is_error":true,"api_error_status":429,"result":"API Error: 429 {\"type\":\"error\",\"error\":{\"type\":\"rate_limit_error\",\"details\":{\"error_code\":\"enforced_spend_limit_reached\"}}}","usage":{"input_tokens":0,"output_tokens":0},"total_cost_usd":0,"duration_ms":10}'
exit 1
STUB

# An ordinary failure - nothing to do with the provider's quota.
cat > "$ROOT/bin/claude-that-fails" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' '{"type":"result","subtype":"error_during_execution","is_error":true,"result":"Tool execution failed","usage":{"input_tokens":0,"output_tokens":0},"total_cost_usd":0,"duration_ms":10}'
exit 1
STUB

# Pi reports a failed turn as an assistant message with stopReason "error" - here OpenAI's own words
# for a spent quota, with no code in the text.
pi_stub() {
    local name="$1" message="$2"
    cat > "$ROOT/bin/$name" <<STUB
#!/usr/bin/env bash
printf '%s\n' '{"type":"message_end","message":{"role":"assistant","stopReason":"error","errorMessage":"${message}"}}'
printf '%s\n' '{"type":"agent_settled"}'
printf '%s\n' '{"type":"response","id":"direct-final-text","command":"get_last_assistant_text","success":true,"data":{"text":""}}'
printf '%s\n' '{"type":"response","id":"direct-final-stats","command":"get_session_stats","success":true,"data":{"tokens":{"input":10,"output":0},"cost":0}}'
sleep 30
STUB
}
pi_stub pi-out-of-quota "429 You exceeded your current quota, please check your plan and billing details."
pi_stub pi-that-fails "Connection reset by peer"
chmod +x "$ROOT"/bin/*

run_worker() {
    local label="$1" harness="$2" agent="$3"
    local script="$ROOT/entrypoint-${label}.sh"
    sed "s#/workspace#${ROOT}/workspace#g" "$ENTRYPOINT" > "$script"
    rm -rf "${ROOT:?}/workspace" "${ROOT:?}/home" "${ROOT:?}/callbacks.jsonl"
    rm -f /tmp/claude-in /tmp/claude-exit /tmp/claude-stream.jsonl
    rm -f /tmp/pi-in /tmp/pi-done /tmp/pi-rejected /tmp/pi-consumer-done /tmp/pi-stream.jsonl
    mkdir -p "$ROOT/home"

    local harness_env=()
    if [[ "$harness" == pi ]]; then
        cp "$ROOT/bin/$agent" "$ROOT/bin/pi"
        harness_env=(DIRECT_HARNESS=pi DIRECT_PROVIDER=openai-codex DIRECT_PI_OAUTH_CREDENTIAL="$CREDENTIAL" DIRECT_MODEL=gpt-5.3-codex)
    else
        cp "$ROOT/bin/$agent" "$ROOT/bin/claude"
        harness_env=(DIRECT_MODEL=sonnet)
    fi

    env -i \
        HOME="$ROOT/home" \
        PATH="$ROOT/bin:/usr/local/bin:/usr/bin:/bin" \
        "${harness_env[@]}" \
        DIRECT_REPOSITORY_URL="$ROOT/upstream.git" \
        DIRECT_BRANCH="$BRANCH" \
        DIRECT_WORK_ID="spec" \
        DIRECT_CALLBACK_URL="https://direct.example/api/work/spec/callback" \
        DIRECT_CALLBACK_TOKEN="local-callback-token" \
        DIRECT_PROMPT="do the work" \
        bash "$script" > "$ROOT/${label}.log" 2>&1 &
    local worker=$!
    scratch_track_pid "$worker"

    local waited=0
    while kill -0 "$worker" 2>/dev/null && [[ $waited -lt 900 ]]; do sleep 0.1; waited=$((waited + 1)); done
    if kill -0 "$worker" 2>/dev/null; then
        kill -KILL "$worker" 2>/dev/null
    fi
    wait "$worker" 2>/dev/null
    WORKER_STATUS=$?
    scratch_untrack_pid "$worker"
    LAST_CALLBACK=$(grep -v '^$' "$ROOT/callbacks.jsonl" 2>/dev/null | tail -1)
}

fail_case() {
    echo "  RESULT: $1 (rerun with SPEC_KEEP_SCRATCH=1 to keep the scratch tree)"
    echo "  last callback: ${LAST_CALLBACK:-<none>}"
    FAILURES=$((FAILURES + 1))
}

expect() {
    local description="$1" filter="$2"
    if [[ "$(jq -r "$filter" <<<"$LAST_CALLBACK" 2>/dev/null)" != "true" ]]; then
        fail_case "$description"
        return 1
    fi
}

ORIGINAL_FIELDS='["costUsd","cpuSeconds","detail","durationMs","inputTokens","memoryBytes","outputTokens","status"]'

echo "=== a Claude session refused over a spent spend limit reports quotaExhausted ==="
run_worker claude-quota claude claude-out-of-quota
if [[ $WORKER_STATUS -eq 0 ]]; then
    fail_case "the worker exited 0"
elif expect "the callback is not a failed quotaExhausted callback" '.status == "failed" and .reason == "quotaExhausted"' &&
     expect "the callback does not name the provider, model and vendor code" '.provider == "anthropic" and .model == "sonnet" and .vendorCode == "enforced_spend_limit_reached"' &&
     expect "the callback lost the session's own failure text" '.detail | contains("enforced_spend_limit_reached")'; then
    echo "  RESULT: $LAST_CALLBACK"
fi

echo
echo "=== an ordinary Claude failure reports the failed callback unchanged ==="
run_worker claude-failure claude claude-that-fails
if [[ $WORKER_STATUS -eq 0 ]]; then
    fail_case "the worker exited 0"
elif expect "the callback is not the unchanged failed callback" ".status == \"failed\" and .detail == \"Tool execution failed\" and (keys == ${ORIGINAL_FIELDS})"; then
    echo "  RESULT: $LAST_CALLBACK"
fi

echo
echo "=== a Pi turn refused over a spent quota reports quotaExhausted ==="
run_worker pi-quota pi pi-out-of-quota
if [[ $WORKER_STATUS -eq 0 ]]; then
    fail_case "the worker exited 0"
elif expect "the callback is not a failed quotaExhausted callback" '.status == "failed" and .reason == "quotaExhausted"' &&
     expect "the callback does not name the provider and model" '.provider == "openai-codex" and .model == "gpt-5.3-codex"' &&
     expect "the callback names a vendor code the text never carried" 'has("vendorCode") | not'; then
    echo "  RESULT: $LAST_CALLBACK"
fi

echo
echo "=== an ordinary Pi failure reports the failed callback unchanged ==="
run_worker pi-failure pi pi-that-fails
if [[ $WORKER_STATUS -eq 0 ]]; then
    fail_case "the worker exited 0"
elif expect "the callback is not the unchanged failed callback" ".status == \"failed\" and .detail == \"Connection reset by peer\" and (keys == ${ORIGINAL_FIELDS})"; then
    echo "  RESULT: $LAST_CALLBACK"
fi

echo
echo "=== throttling is not read as a spent quota ==="
# shellcheck disable=SC1090
source <(awk '/^quota_exhaustion_code\(\)/ { found = 1 } found { print } found && /^}/ { exit }' "$ENTRYPOINT")
LAST_CALLBACK=""
if ! declare -F quota_exhaustion_code >/dev/null; then
    fail_case "entrypoint.sh has no quota_exhaustion_code to check"
elif quota_exhaustion_code '429 {"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}' >/dev/null; then
    fail_case "an ordinary per-minute rate limit was read as a spent quota"
else
    echo "  RESULT: an ordinary 429 rate_limit_error is not a spent quota"
fi

echo
if [[ $FAILURES -eq 0 ]]; then
    echo "OK"
else
    echo "FAILED (${FAILURES})"
fi
exit "$FAILURES"
