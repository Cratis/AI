#!/usr/bin/env bash
# Pins how run_claude_code() keeps a repository's interactive `ask` rules from blocking a headless
# worker. A cloned repository's .claude/settings.json may ask before `git push` and `gh pr` (the
# Cratis corpus does); in `claude -p` an `ask` rule wins over --dangerously-skip-permissions and the
# call is denied. The session hands those prompts to --permission-prompt-tool instead, and the
# approval server answers them.
#
# What it pins, statically - the invocation is the contract, and a dropped flag costs sessions
# rather than failing a build:
#   - the claude -p invocation passes --permission-prompt-tool with an mcp__<server>__<tool> name;
#   - <server> is a server in the generated MCP config, launched from the path Dockerfile.claude
#     copies headless-approval-mcp-server.mjs to, and <tool> is the tool that server registers;
#   - the invocation does not narrow --setting-sources: leaving out `project` also stops the
#     repository's CLAUDE.md, skills and hooks from loading (verified on Claude Code 2.1.280).
#
# The server's own behavior is covered by headless-approval-mcp-server.test.mjs (npm test).
#
# Run it directly: Source/AgentHarnesses/for_entrypoint/claude-answers-ask-prompts.sh
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
DOCKERFILE="${HERE}/../Dockerfile.claude"
SERVER="${HERE}/../headless-approval-mcp-server.mjs"

failures=0
pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; failures=$((failures + 1)); }
# check CONDITION-STATUS PASS-MESSAGE FAIL-MESSAGE - reports one outcome from a status already taken.
check() { if [[ "$1" == 0 ]]; then pass "$2"; else fail "$3"; fi; }

RUN_CLAUDE_CODE=$(awk '/^run_claude_code\(\)/ { inside = 1 }
                       inside { print }
                       inside && /^}$/ { exit }' "$ENTRYPOINT")
[[ -n "$RUN_CLAUDE_CODE" ]] || { echo "FAILED to lift run_claude_code out of entrypoint.sh"; exit 1; }

# The invocation itself: from `claude -p` to the first line that does not continue with a backslash.
INVOCATION=$(awk '/claude -p \\$/ { inside = 1 }
                  inside { print }
                  inside && !/\\$/ { exit }' <<<"$RUN_CLAUDE_CODE")
invocations=$(grep -c 'claude -p' <<<"$RUN_CLAUDE_CODE")
[[ "$invocations" == 1 ]]
check $? "run_claude_code has exactly one claude -p invocation" \
    "run_claude_code has ${invocations} claude -p invocations; this fixture checks one"
[[ -n "$INVOCATION" ]] || { echo "FAILED to find the claude -p invocation"; exit 1; }

PROMPT_TOOL=$(sed -n 's/.*--permission-prompt-tool \([^ ]*\).*/\1/p' <<<"$INVOCATION")
if [[ "$PROMPT_TOOL" =~ ^mcp__([a-z_]+)__([a-z_]+)$ ]]; then
    pass "claude -p passes --permission-prompt-tool ${PROMPT_TOOL}"
    SERVER_KEY="${BASH_REMATCH[1]}"
    TOOL_NAME="${BASH_REMATCH[2]}"
else
    fail "claude -p does not pass --permission-prompt-tool mcp__<server>__<tool> (found [${PROMPT_TOOL}])"
    SERVER_KEY=""
    TOOL_NAME=""
fi

grep -q -- '--dangerously-skip-permissions' <<<"$INVOCATION"
check $? "claude -p still passes --dangerously-skip-permissions" \
    "claude -p no longer passes --dangerously-skip-permissions"

! grep -q -- '--setting-sources' <<<"$INVOCATION"
check $? "claude -p loads every setting source, so project CLAUDE.md, skills and hooks still load" \
    "claude -p narrows --setting-sources, which also drops the repository's CLAUDE.md and skills"

if [[ -n "$SERVER_KEY" ]]; then
    SERVER_PATH=$(awk -v key="${SERVER_KEY}:" '$1 == key { inside = 1 } inside && /args:/ { print; exit }' <<<"$RUN_CLAUDE_CODE" |
        sed -n 's/.*args: \["\([^"]*\)"\].*/\1/p')
    if [[ "$SERVER_PATH" == */headless-approval-mcp-server.mjs ]]; then
        pass "MCP config server ${SERVER_KEY} launches ${SERVER_PATH}"
    else
        fail "MCP config server ${SERVER_KEY} does not launch headless-approval-mcp-server.mjs (found [${SERVER_PATH}])"
    fi

    COPY_LINE=$(grep -E '^COPY .*headless-approval-mcp-server\.mjs' "$DOCKERFILE" || true)
    if [[ -n "$COPY_LINE" && "${SERVER_PATH%/*}/" == "${COPY_LINE##* }" ]]; then
        pass "Dockerfile.claude copies the server to ${SERVER_PATH%/*}/"
    else
        fail "Dockerfile.claude does not copy headless-approval-mcp-server.mjs to ${SERVER_PATH%/*}/ (found [${COPY_LINE}])"
    fi

    grep -q "^ *'${TOOL_NAME}',$" "$SERVER"
    check $? "the server registers ${TOOL_NAME}" "headless-approval-mcp-server.mjs does not register ${TOOL_NAME}"
fi

if (( failures > 0 )); then
    echo "FAILED: ${failures} check(s)"
    exit 1
fi
echo "PASSED"
