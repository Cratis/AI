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
mkdir -p "$WORK/home" "$WORK/bin"
export HOME="$WORK/home"
export PATH="$WORK/bin:$PATH"

for function in load_secrets agent_credential_environment prepare_mcp_credentials; do
    eval "$(awk -v fn="$function" '$0 ~ "^" fn "\\(\\)" { inside=1 } inside { print } inside && /^}$/ { exit }' "$ENTRYPOINT")"
done
log() { :; }
fail() { echo "FAIL: $1" >&2; exit 1; }

# Synthetic values only. Start exported to cover inherited export attributes as well as new values.
NAMES='DIRECT_CALLBACK_TOKEN DIRECT_CONTEXT_MCP_TOKEN EXA_API_KEY CONTEXT7_API_KEY GITHUB_TOKEN DIRECT_CLONE_CREDENTIALS ANTHROPIC_API_KEY OPENAI_API_KEY AZURE_OPENAI_API_KEY DIRECT_PROVIDER_API_KEY COPILOT_GITHUB_TOKEN'
DIRECT_SECRETS_FILE="$WORK/credentials"
for name in $NAMES; do
    export "$name=fixture-${name}"
    printf '%s=%s\n' "$name" "fixture-${name}" >> "$DIRECT_SECRETS_FILE"
done
touch "$WORK/secrets.ready"
load_secrets
[[ "$DIRECT_CALLBACK_TOKEN" == fixture-DIRECT_CALLBACK_TOKEN ]] || fail 'parent lost its callback value'
read -r -a credential_names <<< "$NAMES"
bash -c 'for name in "$@"; do [[ -z "${!name+x}" ]] || exit 1; done' -- "${credential_names[@]}" || fail 'unrelated child inherited a credential'
echo '  PASS: loaded values remain in the parent, not unrelated children'

cat > "$WORK/bin/agent-stub" <<'STUB'
#!/usr/bin/env bash
set -eu
for name in DIRECT_CALLBACK_TOKEN DIRECT_CONTEXT_MCP_TOKEN EXA_API_KEY CONTEXT7_API_KEY GITHUB_TOKEN DIRECT_CLONE_CREDENTIALS; do
    [[ -z "${!name+x}" ]] || exit 1
done
for name in ANTHROPIC_API_KEY OPENAI_API_KEY AZURE_OPENAI_API_KEY DIRECT_PROVIDER_API_KEY COPILOT_GITHUB_TOKEN; do
    if [[ "$name" == "$EXPECTED_PROVIDER_VARIABLE" ]]; then
        [[ "${!name:-}" == "fixture-${name}" ]] || exit 1
    else
        [[ -z "${!name+x}" ]] || exit 1
    fi
done
STUB
chmod +x "$WORK/bin/agent-stub"
for agent in claude pi copilot; do ln -s agent-stub "$WORK/bin/$agent"; done
for row in 'claude-code ANTHROPIC_API_KEY claude' 'copilot COPILOT_GITHUB_TOKEN copilot' 'anthropic ANTHROPIC_API_KEY pi' 'openai OPENAI_API_KEY pi' 'azure-openai-responses AZURE_OPENAI_API_KEY pi' 'direct-provider DIRECT_PROVIDER_API_KEY pi'; do
    read -r provider expected agent <<< "$row"
    export EXPECTED_PROVIDER_VARIABLE="$expected"
    agent_credential_environment "$provider"
    # Execute the real launch expression, omitting the timing wrapper and continued arguments.
    invocation=$(awk -v agent="$agent" 'index($0, "env \"${AGENT_CREDENTIAL_ENV[@]}\" " agent " ") { print; exit }' "$ENTRYPOINT")
    [[ -n "$invocation" ]] || fail 'launch expression was not found'
    invocation="${invocation#*-- env}"
    [[ "$invocation" == *'env '* ]] || invocation="env $invocation"
    invocation="${invocation%\\}"
    eval "$invocation" || fail "incorrect credential delivery for $provider"
    echo "  PASS: $provider receives only its provider value"
done

export DIRECT_RUN_MODE=bundle-diff
export DIRECT_CONTEXT_MCP_URL='https://context.example/mcp'
# Lift the actual Claude configuration block, including the optional context merge.
configuration=$(awk '/^run_claude_code\(\)/ { fn=1 } fn && /prepare_mcp_credentials \|\|/ { inside=1 } inside && /^    PIPE=/ { exit } inside { print }' "$ENTRYPOINT")
[[ -n "$configuration" ]] || fail 'configuration block was not found'
eval "$configuration"
for name in $NAMES; do
    ! grep -Fq "fixture-${name}" "$MCP_CONFIG" || fail 'configuration contains a credential value'
done
jq -e '.mcpServers.context.command == "node" and .mcpServers.exa.command == "node" and .mcpServers.context7.command == "node" and (.mcpServers.direct_progress.env | has("DIRECT_CALLBACK_TOKEN") | not)' "$MCP_CONFIG" >/dev/null
node - "$MCP_CREDENTIAL_DIR" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const directory = process.argv[2];
assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
for (const file of fs.readdirSync(directory)) assert.equal(fs.statSync(`${directory}/${file}`).mode & 0o777, 0o600);
assert.equal(fs.readFileSync(`${directory}/progress-token`, 'utf8'), 'fixture-DIRECT_CALLBACK_TOKEN');
assert.equal(JSON.parse(fs.readFileSync(`${directory}/exa.json`)).headers['x-api-key'], 'fixture-EXA_API_KEY');
assert.equal(JSON.parse(fs.readFileSync(`${directory}/context.json`)).headers.Authorization, 'Bearer fixture-DIRECT_CONTEXT_MCP_TOKEN');
assert.equal(JSON.parse(fs.readFileSync(`${directory}/context7.json`)).env.CONTEXT7_API_KEY, 'fixture-CONTEXT7_API_KEY');
NODE
echo '  PASS: MCP configuration contains paths, with private per-process credential files'
