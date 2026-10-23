#!/usr/bin/env bash
# fixture-serial: runs entrypoint.sh code that writes fixed /tmp paths shared with the other serial fixtures
# A spent quota is recognized from the words a vendor or harness uses for it, and only from the text
# that is the error (Cratis/AI#569):
#   - Claude Code's "hit your ... limit" wording matches the qualifiers it is known to use - none,
#     usage, weekly, 5-hour, session, opus, sonnet - and no other word, so an ordinary failure that
#     merely says "hit your rate limit" or "hit your token limit" is not read as a spent quota;
#   - run_copilot reads the error or errored result event, never the agent's own closing prose, which
#     may talk about quotas without the session having been refused over one.
#
# quota_exhaustion_code and run_copilot are lifted verbatim out of entrypoint.sh. run_copilot gets the
# one substitution copilot-programmatic-invocation.sh makes: the GNU-only `/usr/bin/time -v` wrapper
# is dropped, and `date +%s%3N` is shimmed where the platform's date cannot do it. It runs on macOS
# and Linux.
#
# Exits non-zero when the behavior is not in effect.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
# shellcheck source=lib/scratch.sh
source "${HERE}/lib/scratch.sh"
scratch_create quota-detection
WORK="$SCRATCH_ROOT"
mkdir -p "$WORK/bin"
export PATH="$WORK/bin:$PATH"

command -v jq >/dev/null || { echo "SKIPPED: jq is not installed"; exit 0; }

lift() {
    awk -v name="$1" '$0 ~ "^" name "\\(\\)" { inside = 1 } inside { print } inside && /^}$/ { exit }' "$ENTRYPOINT"
}

lift quota_exhaustion_code > "$WORK/lifted.sh"
lift run_copilot > "$WORK/run_copilot.sh"
grep -q 'quota_exhaustion_code()' "$WORK/lifted.sh" || { echo "FAILED to lift quota_exhaustion_code out of entrypoint.sh"; exit 1; }
grep -q 'run_copilot()' "$WORK/run_copilot.sh" || { echo "FAILED to lift run_copilot out of entrypoint.sh"; exit 1; }
grep -q '/usr/bin/time -v' "$WORK/run_copilot.sh" || { echo "FAILED: run_copilot no longer wraps the CLI in /usr/bin/time -v"; exit 1; }
sed -i.bak 's#/usr/bin/time -v -o "\$COPILOT_TIME_FILE" -- copilot#copilot#' "$WORK/run_copilot.sh"
# shellcheck source=/dev/null
. "$WORK/lifted.sh"
# shellcheck source=/dev/null
. "$WORK/run_copilot.sh"

failures=0
check() {
    local what="$1" expected="$2" actual="$3"
    if [[ "$expected" == "$actual" ]]; then
        echo "  PASS: ${what}"
    else
        echo "  FAIL: ${what} (expected [${expected}], got [${actual}])"
        failures=$((failures + 1))
    fi
}

is_quota() { quota_exhaustion_code "$1" >/dev/null && echo yes || echo no; }

echo "=== Claude Code's own wording for a spent subscription allowance ==="
check "hit your limit" yes "$(is_quota "You've hit your limit · resets 3pm (UTC)")"
check "hit your weekly limit" yes "$(is_quota "You've hit your weekly limit · resets Oct 9, 2am (UTC)")"
check "hit your 5-hour limit" yes "$(is_quota "You have hit your 5-hour limit")"
check "hit your session limit" yes "$(is_quota "You've hit your session limit")"
check "hit your opus limit" yes "$(is_quota "You've hit your Opus limit")"
check "hit your sonnet limit" yes "$(is_quota "You've hit your Sonnet limit")"
check "hit your usage limit" yes "$(is_quota "You've hit your usage limit for this plan")"
check "usage limit reached" yes "$(is_quota "Claude AI usage limit reached|1760000000")"

echo
echo "=== Any other word before \"limit\" is not a spent quota ==="
check "hit your rate limit" no "$(is_quota "Number of request tokens has hit your rate limit")"
check "hit your token limit" no "$(is_quota "The prompt hit your token limit for one message")"
check "hit your file limit" no "$(is_quota "The tool hit your file limit of 200 entries")"

echo
echo "=== The Copilot quota check reads the error, not the agent's prose ==="
cat > "$WORK/bin/copilot" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$@" > /dev/null
cat "${COPILOT_STUB_STREAM}"
exit "${COPILOT_STUB_EXIT:-0}"
STUB
chmod +x "$WORK/bin/copilot"

if [[ "$(date +%s%3N)" == *N ]]; then
    cat > "$WORK/bin/date" <<'STUB'
#!/usr/bin/env bash
if [[ "${1:-}" == "+%s%3N" ]]; then
    printf '%s000\n' "$(/bin/date +%s)"
else
    exec /bin/date "$@"
fi
STUB
    chmod +x "$WORK/bin/date"
fi

REPORT_FILE="$WORK/report"
log() { :; }
report() { printf '%s\n' "$*" > "$REPORT_FILE"; }
push_workspaces() { true; }
claude_cpu_seconds_from_time_file() { printf '0'; }
claude_memory_bytes_from_time_file() { printf '0'; }

run_session() {
    : > "$REPORT_FILE"
    PROMPT_FILE="$WORK/prompt.md"
    printf 'Do the work.' > "$PROMPT_FILE"
    AGENT_PID=""
    ( run_copilot ) > "$WORK/session.log" 2>&1
}
export COPILOT_STUB_STREAM="$WORK/stream.jsonl"
export DIRECT_MODEL="claude-sonnet-4.6"
unset DIRECT_AI_PROFILE_PROMPT_FILE DIRECT_RUN_MODE DIRECT_HEADROOM

# The session failed for an unrelated reason, but the agent's last words discuss a quota.
cat > "$COPILOT_STUB_STREAM" <<'JSONL'
{"type":"error","message":"Connection reset by peer"}
{"type":"assistant","text":"I checked the billing code and saw insufficient_quota handled in retry.ts"}
JSONL
export COPILOT_STUB_EXIT=1
run_session
check "prose that mentions a quota is not a quotaExhausted report" 0 "$(grep -c quotaExhausted "$REPORT_FILE")"
check "the session is still reported failed" failed "$(cut -d' ' -f1 < "$REPORT_FILE")"

# The CLI reported the quota failure as an error event, with the agent talking about something else after.
cat > "$COPILOT_STUB_STREAM" <<'JSONL'
{"type":"error","message":"429 You exceeded your current quota, please check your plan and billing details."}
{"type":"assistant","text":"Stopping here."}
JSONL
run_session
check "an error event naming the quota is reported as quotaExhausted" 1 "$(grep -c quotaExhausted "$REPORT_FILE")"

# An errored result event counts the same way.
cat > "$COPILOT_STUB_STREAM" <<'JSONL'
{"type":"assistant","text":"Working"}
{"type":"result","is_error":true,"result":"You've hit your weekly limit"}
JSONL
run_session
check "an errored result event naming the allowance is reported as quotaExhausted" 1 "$(grep -c quotaExhausted "$REPORT_FILE")"

echo
if [[ $failures -eq 0 ]]; then
    echo "OK"
else
    echo "FAILED (${failures})"
fi
exit "$failures"
