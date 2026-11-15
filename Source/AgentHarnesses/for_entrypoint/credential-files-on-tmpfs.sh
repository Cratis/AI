#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
# shellcheck source=lib/scratch.sh
source "${HERE}/lib/scratch.sh"
scratch_create credential-files
WORK="$SCRATCH_ROOT"
mkdir -p "$WORK/home" "$WORK/bin" "$WORK/secrets" "$WORK/shm" "$WORK/not-tmpfs"
export HOME="$WORK/home"
export REAL_STAT="$(command -v stat)"
export DIRECT_SECRETS_FILE="$WORK/secrets/credentials"
export FIXTURE_TMPFS="$WORK/secrets" FIXTURE_SHM="$WORK/shm"
export PATH="$WORK/bin:$PATH"
FAILURES=0
fail() { echo "  FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
log() { printf '%s\n' "$*" >> "$WORK/messages"; }

cat > "$WORK/bin/stat" <<'STUB'
#!/usr/bin/env bash
if [[ "$1 $2 $3" == '-f -c %T' ]]; then
    if [[ "$4" == "$FIXTURE_TMPFS" || "$4" == "$FIXTURE_SHM" ]]; then echo tmpfs; else echo ext4; fi
    exit 0
fi
exec "$REAL_STAT" "$@"
STUB
cat > "$WORK/bin/kubectl" <<'STUB'
#!/usr/bin/env bash
[[ -f "$KUBECONFIG" && -z "${DIRECT_KUBECONFIG+x}" ]] || exit 1
printf '%s\n' "$*" > "$HOME/kubectl-call"
STUB
chmod +x "$WORK/bin/stat" "$WORK/bin/kubectl"

for function in credential_scratch_dir prepare_mcp_credentials configure_kubernetes_access configure_pi_provider; do
    definition=$(awk -v fn="$function" '$0 ~ "^" fn "\\(\\)" { inside=1 } inside { print } inside && /^[})]$/ { exit }' "$ENTRYPOINT")
    # Only the fixed fallback path changes: use a private stand-in even on hosts without /dev/shm.
    definition="${definition//\/dev\/shm/$WORK/shm}"
    eval "$definition"
done
# Exercise the pre-extraction block too, so the regression assertions fail on the old entrypoint.
if ! declare -F configure_kubernetes_access >/dev/null; then
    block=$(awk '/^if \[\[ -n "\$\{DIRECT_KUBECONFIG/ { inside=1 } inside { print } inside && /^fi$/ { exit }' "$ENTRYPOINT")
    eval "configure_kubernetes_access() { ${block}
}"
fi

assert_private_file() {
    node - "$1" "$WORK" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [file, root] = process.argv.slice(2);
assert.ok(file.startsWith(`${root}/secrets/`) || file.startsWith(`${root}/shm/`), 'Credential file is outside tmpfs');
assert.equal(fs.statSync(file).mode & 0o777, 0o600);
NODE
}
assert_home_clean() {
    if find "$HOME" -type f -exec grep -l 'fixture-' {} + | grep -q .; then
        fail 'a regular file under HOME contains a credential canary'
    fi
}

if declare -F credential_scratch_dir >/dev/null; then
    [[ "$(credential_scratch_dir)" == "$WORK/secrets" ]] || fail 'writable secrets tmpfs was not preferred'
    chmod 500 "$WORK/secrets"
    [[ ! -w "$WORK/secrets" ]] || fail 'fixture cannot simulate a read-only secrets mount as this user'
    [[ "$(credential_scratch_dir)" == "$WORK/shm" ]] || fail 'read-only secrets did not fall back to shared memory'
    chmod 700 "$WORK/secrets"
    ln -s "$WORK/secrets" "$WORK/linked-secrets"
    DIRECT_SECRETS_FILE="$WORK/linked-secrets/credentials"
    [[ "$(credential_scratch_dir)" == "$WORK/shm" ]] || fail 'symlinked secrets directory was accepted'
    DIRECT_SECRETS_FILE="$WORK/not-tmpfs/credentials"
    [[ "$(credential_scratch_dir)" == "$WORK/shm" ]] || fail 'non-tmpfs secrets did not fall back'
    unset DIRECT_SECRETS_FILE
    [[ "$(credential_scratch_dir)" == "$WORK/shm" ]] || fail 'unset secrets file did not use shared memory'
else
    fail 'credential scratch selection is missing'
fi
DIRECT_SECRETS_FILE="$WORK/secrets/credentials"
previous_umask=$(umask)
mktemp() { return 1; }
if prepare_mcp_credentials; then fail 'MCP setup ignored mktemp failure'; fi
unset -f mktemp
[[ "$(umask)" == "$previous_umask" ]] || fail 'MCP creation failure changed the caller umask'

DIRECT_KUBECONFIG=fixture-kubeconfig
export -n DIRECT_KUBECONFIG
DIRECT_KUBE_NAMESPACE=test-namespace
previous_umask=$(umask)
configure_kubernetes_access
[[ "$(umask)" == "$previous_umask" ]] || fail 'kubeconfig setup changed the caller umask'
[[ ! -e "$HOME/.kube/config" ]] || fail 'kubeconfig was written under HOME'
[[ -n "${KUBECONFIG:-}" ]] || fail 'KUBECONFIG was not configured'
if [[ -n "${KUBECONFIG:-}" ]]; then
    assert_private_file "$KUBECONFIG" || fail 'kubeconfig is not private on tmpfs'
    [[ "$(cat "$KUBECONFIG")" == fixture-kubeconfig ]] || fail 'kubeconfig content changed'
    bash -c '[[ -f "$KUBECONFIG" && -z "${DIRECT_KUBECONFIG+x}" ]]' || fail 'incorrect kubeconfig child environment'
fi
[[ "$(cat "$HOME/kubectl-call" 2>/dev/null)" == 'config set-context --current --namespace test-namespace' ]] || fail 'namespace configuration was not preserved'
assert_home_clean

HEADROOM_PORT=8787 HEADROOM_PID=''
DIRECT_PROVIDER=openai-codex
DIRECT_PI_OAUTH_CREDENTIAL='{"type":"oauth","access":"fixture-access","refresh":"fixture-refresh","expires":4102444800000}'
export -n DIRECT_PI_OAUTH_CREDENTIAL
configure_pi_provider
[[ "$(umask)" == "$previous_umask" ]] || fail 'Pi setup changed the caller umask'
auth="$HOME/.pi/agent/auth.json"
[[ -L "$auth" ]] || fail 'Pi auth.json is not a symlink'
if [[ -L "$auth" ]]; then
    target=$(readlink "$auth")
    assert_private_file "$target" || fail 'Pi credential target is not private on tmpfs'
fi
jq -e '."openai-codex".refresh == "fixture-refresh"' "$auth" >/dev/null || fail 'Pi credential shape changed'
assert_home_clean

# Use a fresh HOME to prove refusal creates no credential files.
export HOME="$WORK/refused-home"
mkdir -p "$HOME"
FIXTURE_TMPFS='' FIXTURE_SHM=''
if declare -F credential_scratch_dir >/dev/null; then
    if credential_scratch_dir >/dev/null; then fail 'scratch selection accepted non-tmpfs storage'; fi
fi
if prepare_mcp_credentials; then fail 'MCP setup accepted non-tmpfs storage'; fi
[[ "$(umask)" == "$previous_umask" ]] || fail 'MCP refusal changed the caller umask'
unset KUBECONFIG
configure_kubernetes_access
[[ -z "${KUBECONFIG:-}" && ! -e "$HOME/.kube/config" ]] || fail 'kubeconfig refusal wrote a credential'
configure_pi_provider
[[ ! -e "$HOME/.pi/agent/auth.json" && ! -e "$HOME/.pi/agent/auth.json.tmp" ]] || fail 'Pi refusal wrote a credential'
assert_home_clean
[[ "$(umask)" == "$previous_umask" ]] || fail 'refusal changed the caller umask'
if [[ "$FAILURES" -ne 0 ]]; then exit 1; fi
echo '  PASS: credential scratch selection, kubeconfig, Pi auth symlink and non-tmpfs refusal'
