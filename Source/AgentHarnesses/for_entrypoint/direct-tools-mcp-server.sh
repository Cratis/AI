#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# fixture-serial: exercises the generated MCP configurations' fixed /tmp paths
#
# DIRECT_TOOLS_MCP_URL becomes the `direct_tools` MCP server in the Claude Code and Copilot
# configurations, outside bundle-diff mode too, through the credential bridge: the per-run callback
# token sits in a private file and never in the client configuration, an argument or a log.
# Assertions are single-quoted strings evaluated by check(); the extracted entrypoint code reads the
# variables set here.
# shellcheck disable=SC2016,SC2034
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
# shellcheck source=lib/scratch.sh
source "${HERE}/lib/scratch.sh"
scratch_create direct-tools-mcp
WORK="$SCRATCH_ROOT"
mkdir -p "$WORK/home" "$WORK/bin" "$WORK/tmpfs" "$WORK/observations"
export HOME="$WORK/home"
REAL_STAT="$(command -v stat)"
export REAL_STAT DIRECT_SECRETS_FILE="$WORK/tmpfs/credentials"
cat > "$WORK/bin/stat" <<'STUB'
#!/usr/bin/env bash
if [[ "$1 $2 $3" == '-f -c %T' ]]; then
    [[ "$4" == "${DIRECT_SECRETS_FILE%/*}" ]] && { echo tmpfs; exit 0; }
    echo ext4
    exit 0
fi
exec "$REAL_STAT" "$@"
STUB
chmod +x "$WORK/bin/stat"
export PATH="$WORK/bin:$PATH"

for function in credential_scratch_dir prepare_mcp_credentials validate_direct_tools; do
    definition=$(awk -v fn="$function" '$0 ~ "^" fn "\\(\\)" { inside=1 } inside { print } inside && /^[})]$/ { exit }' "$ENTRYPOINT")
    [[ -n "$definition" ]] || { echo "FAIL: ${function} not found" >&2; exit 1; }
    eval "$definition"
done
log() { :; }
fail() { echo "$1" >&2; exit 1; }
FAILURES=0
check() { if eval "$2"; then echo "  PASS: $1"; else echo "  FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); fi; }

claude_block=$(awk '/^run_claude_code\(\)/ { fn=1 } fn && /prepare_mcp_credentials \|\|/ { inside=1 } inside && /^    PIPE=/ { exit } inside { print }' "$ENTRYPOINT")
copilot_block=$(awk '/^run_copilot\(\)/ { fn=1 } fn && /prepare_mcp_credentials \|\|/ { inside=1 } inside && /^    COPILOT_MCP_ARGS=\(/ { exit } inside { print }' "$ENTRYPOINT")
[[ -n "$claude_block" && -n "$copilot_block" ]] || { echo 'FAIL: MCP configuration blocks not found' >&2; exit 1; }

# Synthetic value only; the canary must never leave the private credential file.
DIRECT_CALLBACK_TOKEN='fixture-direct-tools-canary'
unset DIRECT_RUN_MODE DIRECT_CONTEXT_MCP_URL DIRECT_CONTEXT_MCP_TOKEN EXA_API_KEY CONTEXT7_API_KEY
export DIRECT_TOOLS_MCP_URL='https://direct.example/work/42/tools/mcp'
BRIDGE=/usr/local/lib/direct-progress-mcp/credential-mcp-server.mjs

echo '=== Claude Code and Copilot both get direct_tools through the credential bridge ==='
eval "$claude_block"
cp "$MCP_CONFIG" "$WORK/observations/claude.json"
claude_credentials="$MCP_CREDENTIAL_DIR"
eval "$copilot_block"
cp "$COPILOT_MCP_CONFIG" "$WORK/observations/copilot.json"
check 'Claude Code runs the bridge on the private credential file' \
    'jq -e --arg bridge "$BRIDGE" --arg file "$claude_credentials/direct-tools.json" ".mcpServers.direct_tools == {command: \"node\", args: [\$bridge, \$file]}" "$WORK/observations/claude.json" > /dev/null'
check 'Copilot runs the bridge as a local server exposing every tool' \
    'jq -e --arg bridge "$BRIDGE" --arg file "$MCP_CREDENTIAL_DIR/direct-tools.json" ".mcpServers.direct_tools == {type: \"local\", command: \"node\", args: [\$bridge, \$file], tools: [\"*\"]}" "$WORK/observations/copilot.json" > /dev/null'
check 'Copilot keeps its progress server' 'jq -e ".mcpServers.direct_progress.command == \"node\"" "$WORK/observations/copilot.json" > /dev/null'
check 'the credential file carries the URL and the bearer token' \
    'jq -e --arg url "$DIRECT_TOOLS_MCP_URL" ". == {url: \$url, headers: {Authorization: \"Bearer fixture-direct-tools-canary\"}}" "$claude_credentials/direct-tools.json" > /dev/null'
check 'the credential file is private on tmpfs' \
    '[[ "$claude_credentials" == "$WORK/tmpfs/"* && "$("$REAL_STAT" -c %a "$claude_credentials/direct-tools.json" 2>/dev/null || "$REAL_STAT" -f %Lp "$claude_credentials/direct-tools.json")" == 600 ]]'
check 'no client configuration contains the token' '! grep -rq fixture-direct-tools-canary "$WORK/observations"'

echo '=== Without DIRECT_TOOLS_MCP_URL nothing changes ==='
unset DIRECT_TOOLS_MCP_URL
eval "$claude_block"
check 'Claude Code has no direct_tools server' 'jq -e ".mcpServers | has(\"direct_tools\") | not" "$MCP_CONFIG" > /dev/null'
check 'no tools credential file is written' '[[ ! -e "$MCP_CREDENTIAL_DIR/direct-tools.json" ]]'
eval "$copilot_block"
check 'Copilot has no direct_tools server' 'jq -e ".mcpServers | has(\"direct_tools\") | not" "$COPILOT_MCP_CONFIG" > /dev/null'

echo '=== Startup validation ==='
check 'an https URL with a callback token is accepted' '( DIRECT_TOOLS_MCP_URL=https://direct.example/mcp validate_direct_tools )'
check 'an http URL is accepted' '( DIRECT_TOOLS_MCP_URL=http://direct:8080/mcp validate_direct_tools )'
check 'unset is accepted' '( unset DIRECT_TOOLS_MCP_URL; validate_direct_tools )'
for url in 'ftp://direct.example/mcp' 'direct.example/mcp' 'https://' $'https://direct.example/mcp\nx' 'https://direct.example/a b'; do
    check "'${url//$'\n'/\\n}' is refused" '! ( DIRECT_TOOLS_MCP_URL="$url" validate_direct_tools ) 2> "$WORK/error" && grep -q "^\[mcp\]" "$WORK/error"'
done
check 'a missing callback token is refused' '! ( DIRECT_TOOLS_MCP_URL=https://direct.example/mcp DIRECT_CALLBACK_TOKEN="" validate_direct_tools ) 2> "$WORK/error" && grep -q "requires DIRECT_CALLBACK_TOKEN" "$WORK/error"'

if [[ $FAILURES -ne 0 ]]; then
    echo "direct tools MCP server: ${FAILURES} failure(s)" >&2
    exit 1
fi
echo 'direct tools MCP server: wired for Claude Code and Copilot without exposing the callback token'
