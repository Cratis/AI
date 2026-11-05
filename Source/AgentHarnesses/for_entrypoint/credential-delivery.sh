#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# fixture-serial: exercises the generated MCP configuration's fixed /tmp path
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
# shellcheck source=lib/scratch.sh
source "${HERE}/lib/scratch.sh"
scratch_create credential-delivery
WORK="$SCRATCH_ROOT"
mkdir -p "$WORK/home" "$WORK/bin" "$WORK/observations"
export HOME="$WORK/home"
REAL_JQ="$(command -v jq)"
export REAL_JQ
export PATH="$WORK/bin:$PATH"
export FIXTURE_ARGV_LOG="$WORK/observations/argv.log"

for function in load_secrets agent_credential_environment exec_agent_with_credentials prepare_mcp_credentials; do
    eval "$(awk -v fn="$function" '$0 ~ "^" fn "\\(\\)" { inside=1 } inside { print } inside && /^[})]$/ { exit }' "$ENTRYPOINT")"
done
log() { :; }
fail() { echo "FAIL: $1" >&2; exit 1; }

# Synthetic values only. Start exported to cover inherited export attributes as well as new values.
NAMES='DIRECT_CALLBACK_TOKEN DIRECT_CONTEXT_MCP_TOKEN EXA_API_KEY CONTEXT7_API_KEY GITHUB_TOKEN DIRECT_CLONE_CREDENTIALS ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN OPENAI_API_KEY AZURE_OPENAI_API_KEY DIRECT_PROVIDER_API_KEY COPILOT_GITHUB_TOKEN ZAI_API_KEY DIRECT_PI_OAUTH_CREDENTIAL'
DIRECT_SECRETS_FILE="$WORK/credentials"
for name in $NAMES; do
    export "$name=fixture-${name}"
    printf '%s=%s\n' "$name" "fixture-${name}" >> "$DIRECT_SECRETS_FILE"
done
touch "$WORK/secrets.ready"
load_secrets
[[ "$DIRECT_CALLBACK_TOKEN" == fixture-DIRECT_CALLBACK_TOKEN ]] || fail 'parent lost its callback value'
read -r -a credential_names <<< "$NAMES"
assert_parent_scope() {
    bash -c 'for name in "$@"; do [[ -z "${!name+x}" ]] || exit 1; done' -- "${credential_names[@]}" || fail 'unrelated child inherited a credential'
}
assert_parent_scope
echo '  PASS: loaded values remain in the parent, not unrelated children'

cat > "$WORK/bin/agent-stub" <<'STUB'
#!/usr/bin/env bash
set -eu
printf 'agent argv: %s\n' "$*" >> "$FIXTURE_ARGV_LOG"
ps -p "$$" -o command= >> "$FIXTURE_ARGV_LOG"
ps -p "$PPID" -o command= >> "$FIXTURE_ARGV_LOG"
[[ -z "${FIXTURE_AGENT_PID_FILE:-}" ]] || printf '%s\n' "$$" > "$FIXTURE_AGENT_PID_FILE"
for name in DIRECT_CALLBACK_TOKEN DIRECT_CONTEXT_MCP_TOKEN EXA_API_KEY CONTEXT7_API_KEY GITHUB_TOKEN DIRECT_CLONE_CREDENTIALS DIRECT_PI_OAUTH_CREDENTIAL; do
    [[ -z "${!name+x}" ]] || exit 1
done
for name in ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN OPENAI_API_KEY AZURE_OPENAI_API_KEY DIRECT_PROVIDER_API_KEY COPILOT_GITHUB_TOKEN ZAI_API_KEY; do
    case ",${EXPECTED_PROVIDER_VARIABLES}," in
        *",${name},"*) [[ "${!name:-}" == "fixture-${name}" ]] || exit 1 ;;
        *) [[ -z "${!name+x}" ]] || exit 1 ;;
    esac
done
STUB
cat > "$WORK/bin/time" <<'STUB'
#!/usr/bin/env bash
set -eu
printf 'time argv: %s\n' "$*" >> "$FIXTURE_ARGV_LOG"
ps -p "$$" -o command= >> "$FIXTURE_ARGV_LOG"
[[ "$1" == -v && "$2" == -o && "$4" == -- ]]
report="$3"
shift 4
# GNU time includes the entire command, not just the executable, in its report.
printf 'Command being timed: %s\n' "$*" > "$report"
exec "$@"
STUB
cat > "$WORK/bin/jq" <<'STUB'
#!/usr/bin/env bash
set -eu
printf 'jq argv: %s\n' "$*" >> "$FIXTURE_ARGV_LOG"
exec "$REAL_JQ" "$@"
STUB
cat > "$WORK/bin/env" <<'STUB'
#!/usr/bin/env bash
printf 'env argv: %s\n' "$*" >> "$FIXTURE_ARGV_LOG"
exec /usr/bin/env "$@"
STUB
chmod +x "$WORK/bin/agent-stub" "$WORK/bin/time" "$WORK/bin/jq" "$WORK/bin/env"
for agent in claude pi copilot; do ln -s agent-stub "$WORK/bin/$agent"; done

node "$HERE/lib/dispatched-provider-cases.mjs" > "$WORK/provider-cases"
[[ -s "$WORK/provider-cases" ]] || fail 'no dispatched providers were examined'
while IFS='|' read -r provider agent expected; do
    export EXPECTED_PROVIDER_VARIABLES="$expected"
    export DIRECT_PROVIDER="$provider"
    export TIME_FILE="$WORK/observations/${provider}-time"
    export COPILOT_TIME_FILE="$TIME_FILE"
    # Execute the real launch expression and wrapper. Replace only GNU time's binary for macOS.
    invocation=$(awk -v agent="$agent" '/exec_agent_with_credentials / && index($0, " " agent " ") { print; exit }' "$ENTRYPOINT")
    [[ -n "$invocation" ]] || fail 'launch expression was not found'
    invocation="${invocation/\/usr\/bin\/time/time}"
    invocation="${invocation%\\}"
    ( eval "$invocation" ) > "$WORK/observations/${provider}.log" 2>&1 || fail "incorrect credential delivery for $provider"
    assert_parent_scope
    if [[ "$agent" == pi ]]; then
        pi_provider="$provider"
        pi_variables="$expected"
    fi
    echo "  PASS: dispatched $provider receives only its provider values"
done < "$WORK/provider-cases"
[[ -s "$WORK/observations/claude-code-time" && -s "$WORK/observations/copilot-time" ]] || fail 'timing reports were not examined'
export EXPECTED_PROVIDER_VARIABLES="$pi_variables"
export FIXTURE_AGENT_PID_FILE="$WORK/agent-pid"
exec_agent_with_credentials "$pi_provider" pi --mode rpc > "$WORK/observations/pi-background.log" 2>&1 &
pi_pid=$!
wait "$pi_pid"
read -r observed_pid < "$FIXTURE_AGENT_PID_FILE"
[[ "$observed_pid" == "$pi_pid" ]] || fail 'background Pi PID does not identify the CLI'
assert_parent_scope
echo '  PASS: the background Pi PID remains the CLI PID'

export DIRECT_RUN_MODE=bundle-diff
export DIRECT_CONTEXT_MCP_URL='https://context.example/mcp'
# Lift the actual Claude configuration block, including the optional context merge.
configuration=$(awk '/^run_claude_code\(\)/ { fn=1 } fn && /prepare_mcp_credentials \|\|/ { inside=1 } inside && /^    PIPE=/ { exit } inside { print }' "$ENTRYPOINT")
[[ -n "$configuration" ]] || fail 'configuration block was not found'
eval "$configuration"
cp "$MCP_CONFIG" "$WORK/observations/mcp-config.json"
jq -e '.mcpServers.context.command == "node" and .mcpServers.exa.command == "node" and .mcpServers.context7.command == "node" and (.mcpServers.direct_progress.env | has("DIRECT_CALLBACK_TOKEN") | not)' "$MCP_CONFIG" >/dev/null
node - "$MCP_CREDENTIAL_DIR" "$WORK/observations" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [directory, observations] = process.argv.slice(2);
assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
for (const file of fs.readdirSync(directory)) assert.equal(fs.statSync(`${directory}/${file}`).mode & 0o777, 0o600);
assert.equal(fs.readFileSync(`${directory}/progress-token`, 'utf8'), 'fixture-DIRECT_CALLBACK_TOKEN');
assert.equal(JSON.parse(fs.readFileSync(`${directory}/exa.json`)).headers['x-api-key'], 'fixture-EXA_API_KEY');
assert.equal(JSON.parse(fs.readFileSync(`${directory}/context.json`)).headers.Authorization, 'Bearer fixture-DIRECT_CONTEXT_MCP_TOKEN');
assert.equal(JSON.parse(fs.readFileSync(`${directory}/context7.json`)).env.CONTEXT7_API_KEY, 'fixture-CONTEXT7_API_KEY');
for (const file of fs.readdirSync(observations)) {
    assert.ok(!/fixture-[A-Z_]+/.test(fs.readFileSync(`${observations}/${file}`, 'utf8')), `Credential canary in ${file}`);
}
NODE
echo '  PASS: private MCP files receive credentials without copying them into argv, reports, logs or client configuration'
