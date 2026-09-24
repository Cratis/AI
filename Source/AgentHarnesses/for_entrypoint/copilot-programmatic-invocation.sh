#!/usr/bin/env bash
# Exercises entrypoint.sh's run_copilot() against a stubbed `copilot` binary - the Copilot
# equivalent of the Pi fixtures next to it, and for the same reason: the invocation is the contract
# between this repository and the CLI, and a flag that quietly stops being passed costs a session
# rather than failing a build.
#
# What it pins:
#   - the CLI is invoked programmatically (--prompt), with the permissions its own documentation
#     calls required for non-interactive use, and with JSONL output;
#   - the report_progress MCP server is wired in through --additional-mcp-config, carrying the same
#     DIRECT_PROGRESS_URL / DIRECT_CALLBACK_TOKEN contract the Claude path uses;
#   - the reviewed AI profile prompt reaches the agent even though this CLI has no system-prompt
#     flag (it is prepended to the prompt);
#   - the CLI's own exit code - not the wrapper's - decides whether the session is reported failed;
#   - the workspace push happens before the report, on both the success and the failure path.
#
# run_copilot is lifted verbatim out of entrypoint.sh, with exactly one documented substitution: the
# `/usr/bin/time -v` wrapper is dropped, because it is GNU-specific (absent on macOS, where these
# fixtures are also run by hand) and measures rather than decides anything this fixture is about.
#
# Run it directly: Source/AgentHarnesses/for_entrypoint/copilot-programmatic-invocation.sh
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
WORK="${HERE}/copilot-run"
rm -rf "$WORK"; mkdir -p "$WORK/bin"
export PATH="$WORK/bin:$PATH"

command -v jq >/dev/null || { echo "SKIPPED: jq is not installed"; exit 0; }

LIFTED="$WORK/run_copilot.sh"
awk '/^run_copilot\(\)/ { inside = 1 }
     inside { print }
     inside && /^}$/ { exit }' "$ENTRYPOINT" > "$LIFTED"
grep -q 'run_copilot()' "$LIFTED" || { echo "FAILED to lift run_copilot out of entrypoint.sh"; exit 1; }
grep -q '/usr/bin/time -v' "$LIFTED" || { echo "FAILED: run_copilot no longer wraps the CLI in /usr/bin/time -v"; exit 1; }
sed -i.bak 's#/usr/bin/time -v -o "\$COPILOT_TIME_FILE" -- copilot#copilot#' "$LIFTED"
# shellcheck source=/dev/null
. "$LIFTED"

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
check_contains() {
    local what="$1" needle="$2" haystack="$3"
    if [[ "$haystack" == *"$needle"* ]]; then
        echo "  PASS: ${what}"
    else
        echo "  FAIL: ${what} (expected to find [${needle}])"
        failures=$((failures + 1))
    fi
}

# The collaborators run_copilot calls into, stubbed down to what this fixture observes.
ORDER_FILE="$WORK/order"
REPORT_FILE="$WORK/report"
log() { printf '[agent-harness] %s\n' "$*"; }
report() { printf '%s\n' "report $*" >> "$ORDER_FILE"; printf '%s\n' "$*" > "$REPORT_FILE"; }
push_workspaces() { printf 'push\n' >> "$ORDER_FILE"; }
claude_cpu_seconds_from_time_file() { printf '0'; }
claude_memory_bytes_from_time_file() { printf '0'; }

ARGS_FILE="$WORK/copilot-args"
cat > "$WORK/bin/copilot" <<'STUB'
#!/usr/bin/env bash
# Records how it was invoked, then answers with the JSONL a real session's stream carries.
printf '%s\n' "$@" > "${COPILOT_STUB_ARGS}"
printf '%s' "$COPILOT_STUB_STDIN_MARKER" >/dev/null
printf '%s\n' '{"type":"assistant","text":"first"}'
printf '%s\n' '{"type":"assistant","text":"the final answer","usage":{"input_tokens":11,"output_tokens":7}}'
exit "${COPILOT_STUB_EXIT:-0}"
STUB
chmod +x "$WORK/bin/copilot"
export COPILOT_STUB_ARGS="$ARGS_FILE"

# `date +%s%3N` is GNU - the worker image's own date, and what run_copilot/run_pi use for their
# millisecond timestamps. BSD date (macOS, where these fixtures are also run by hand) prints the
# format verbatim, which turns the duration arithmetic into a syntax error that has nothing to do
# with what is being exercised here. Shimmed only when the platform's own date cannot do it.
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

run_session() {
    : > "$ORDER_FILE"
    PROMPT_FILE="$WORK/prompt.md"
    printf 'Do the work.' > "$PROMPT_FILE"
    AGENT_PID=""
    ( run_copilot ) > "$WORK/session.log" 2>&1
    printf '%s' "$?" > "$WORK/session-exit"
}

echo "=== A session that completes ==="
export COPILOT_STUB_EXIT=0
export DIRECT_MODEL="claude-sonnet-4.6"
export DIRECT_PROGRESS_URL="https://direct.example/progress"
export DIRECT_CALLBACK_TOKEN="token-123"
unset DIRECT_AI_PROFILE_PROMPT_FILE
run_session

ARGS="$(cat "$ARGS_FILE")"
check_contains "invokes the CLI programmatically" "--prompt" "$ARGS"
check_contains "hands the CLI the prompt text" "Do the work." "$ARGS"
check_contains "allows tools without confirmation" "--allow-all-tools" "$ARGS"
check_contains "does not stop to ask a person" "--no-ask-user" "$ARGS"
check_contains "asks for JSONL output" "--output-format" "$ARGS"
check_contains "wires in the session MCP configuration" "--additional-mcp-config" "$ARGS"
check_contains "passes the requested model" "claude-sonnet-4.6" "$ARGS"

MCP_CONFIG="$(grep -o '@/tmp/[^ ]*' <<<"$ARGS" | tr -d '@')"
check "names the progress MCP server" "direct_progress" "$(jq -r '.mcpServers | keys[0]' "$MCP_CONFIG")"
check "runs it as a local stdio server" "local" "$(jq -r '.mcpServers.direct_progress.type' "$MCP_CONFIG")"
check "hands it the progress URL" "https://direct.example/progress" "$(jq -r '.mcpServers.direct_progress.env.DIRECT_PROGRESS_URL' "$MCP_CONFIG")"
check "hands it the callback token" "token-123" "$(jq -r '.mcpServers.direct_progress.env.DIRECT_CALLBACK_TOKEN' "$MCP_CONFIG")"

check "reports the last assistant text" "completed" "$(cut -d' ' -f1 < "$REPORT_FILE")"
check_contains "reports the final answer rather than the first line" "the final answer" "$(cat "$REPORT_FILE")"
check "pushes before it reports" "push" "$(head -1 "$ORDER_FILE")"
check "exits successfully" "0" "$(cat "$WORK/session-exit")"

echo
echo "=== A reviewed AI profile prompt, on a CLI with no system-prompt flag ==="
printf 'Reviewed profile instructions.' > "$WORK/profile.md"
export DIRECT_AI_PROFILE_PROMPT_FILE="$WORK/profile.md"
run_session
ARGS="$(cat "$ARGS_FILE")"
check_contains "prepends the reviewed profile to the prompt" "Reviewed profile instructions." "$ARGS"
check_contains "still sends the work's own prompt" "Do the work." "$ARGS"
unset DIRECT_AI_PROFILE_PROMPT_FILE

echo
echo "=== A session the CLI fails ==="
export COPILOT_STUB_EXIT=3
run_session
check "reports the session failed" "failed" "$(cut -d' ' -f1 < "$REPORT_FILE")"
check "still pushes before reporting" "push" "$(head -1 "$ORDER_FILE")"
check "fails the container" "1" "$(cat "$WORK/session-exit")"

echo
echo "=== Headroom is not routed to ==="
export COPILOT_STUB_EXIT=0
export DIRECT_HEADROOM=1
run_session
check_contains "says so rather than silently ignoring it" "cannot route through it" "$(cat "$WORK/session.log")"
check "leaves ANTHROPIC_BASE_URL alone" "" "${ANTHROPIC_BASE_URL:-}"
unset DIRECT_HEADROOM

rm -rf "$WORK"

echo
if [[ $failures -eq 0 ]]; then
    echo "All Copilot invocation checks passed"
else
    echo "${failures} Copilot invocation check(s) failed"
fi
exit "$failures"
