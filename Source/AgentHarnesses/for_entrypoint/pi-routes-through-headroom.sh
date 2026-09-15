#!/usr/bin/env bash
# Exercises entrypoint.sh's configure_pi_provider() (issue #586, extending Headroom - issue #556 -
# to the Pi harness; azure-openai-responses wired in by #646) against every one of Pi's four provider
# shapes, with and without Headroom live, and shows: (1) DIRECT_HEADROOM unset/not-live leaves every
# provider configured byte-identical to how it was before this change, and (2) a live proxy points all
# four - anthropic/openai/direct-openai-compatible/azure-openai-responses - at it with the exact
# strings the plan settled on.
#
# The functions are not reimplemented here - they are lifted verbatim out of entrypoint.sh and
# sourced, so this exercises the real code rather than a copy of it that can drift.
#
# Run it directly: Source/AgentHarnesses/for_entrypoint/pi-routes-through-headroom.sh
# The Headroom-live cases need a real `headroom` on PATH (the worker image has one); without it those
# cases are reported as skipped rather than silently passing.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
WORK="${HERE}/pitest"
rm -rf "$WORK"; mkdir -p "$WORK/bin"

log() { printf '[agent-harness] %s\n' "$*"; }

# Two disjoint ranges, concatenated: HEADROOM_PORT/start_headroom/stop_headroom (configure_pi_provider
# reads HEADROOM_PID, which only start_headroom sets meaningfully) and, separately,
# configure_pi_provider() itself - several hundred lines of unrelated top-level script and the whole
# of run_claude_code() sit between them in entrypoint.sh, and sourcing that in between would run it
# immediately (clone a repository, read DIRECT_PROMPT_FILE, ...) rather than just defining
# functions.
awk '/^HEADROOM_PORT=/ { inside = 1 }
     inside { print }
     /^stop_headroom\(\)/ { last = 1 }
     last && /^}$/ { exit }' "$ENTRYPOINT" > "$WORK/pi-functions.sh"
awk '/^configure_pi_provider\(\)/ { inside = 1 }
     inside { print }
     inside && /^}$/ { exit }' "$ENTRYPOINT" >> "$WORK/pi-functions.sh"
grep -q 'start_headroom()' "$WORK/pi-functions.sh" || { echo "FAILED to lift start_headroom out of entrypoint.sh"; exit 1; }
grep -q 'configure_pi_provider()' "$WORK/pi-functions.sh" || { echo "FAILED to lift configure_pi_provider out of entrypoint.sh"; exit 1; }
# shellcheck source=/dev/null
. "$WORK/pi-functions.sh"

# A port nothing else on the machine is likely to be using, so a stale proxy elsewhere cannot make a
# failing case look like a passing one.
HEADROOM_PORT=18788

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

AGENT_DIR="${WORK}/home/.pi/agent"
reset_home() {
    rm -rf "${WORK}/home"
    mkdir -p "$AGENT_DIR"
    export HOME="${WORK}/home"
}

# stop_headroom sends the kill and returns without waiting for the process to actually die - fine for
# entrypoint.sh, where the container exits right after regardless, but this script's final `rm -rf`
# below can otherwise race a headroom that is still mid-shutdown and writes to $HOME after the
# directory is gone. `wait` blocks on the real exit, not a guessed delay.
stop_and_reap() {
    local pid="$HEADROOM_PID"
    stop_headroom
    [[ -n "$pid" ]] && wait "$pid" 2>/dev/null
    true
}

echo "=== DIRECT_HEADROOM unset - every provider configured exactly as before this change ==="
unset DIRECT_HEADROOM
HEADROOM_PID=""

reset_home
DIRECT_PROVIDER=anthropic
configure_pi_provider
check "anthropic: no models.json written" "false" "$([[ -f "${AGENT_DIR}/models.json" ]] && echo true || echo false)"

reset_home
DIRECT_PROVIDER=openai
configure_pi_provider
check "openai: no models.json written" "false" "$([[ -f "${AGENT_DIR}/models.json" ]] && echo true || echo false)"

reset_home
DIRECT_PROVIDER=azure-openai-responses
DIRECT_PROVIDER_ENDPOINT="https://my-resource.openai.azure.com"
unset AZURE_OPENAI_BASE_URL
configure_pi_provider
check "azure: AZURE_OPENAI_BASE_URL set to the real endpoint" "https://my-resource.openai.azure.com" "${AZURE_OPENAI_BASE_URL:-}"

reset_home
DIRECT_PROVIDER=direct-openai-compatible
DIRECT_PROVIDER_ENDPOINT="https://gateway.example.com/v1"
DIRECT_MODEL="my-model"
unset DIRECT_PROVIDER_API_KEY
configure_pi_provider
check "direct-openai-compatible: baseUrl is the real gateway" \
    "https://gateway.example.com/v1" "$(jq -r '.providers["direct-openai-compatible"].baseUrl' "${AGENT_DIR}/models.json" 2>/dev/null)"

echo
echo "=== DIRECT_HEADROOM=1, but the proxy never came up (HEADROOM_PID empty) - same as unset ==="
DIRECT_HEADROOM=1
HEADROOM_PID=""

reset_home
DIRECT_PROVIDER=anthropic
configure_pi_provider
check "anthropic: no models.json written" "false" "$([[ -f "${AGENT_DIR}/models.json" ]] && echo true || echo false)"

reset_home
DIRECT_PROVIDER=direct-openai-compatible
DIRECT_PROVIDER_ENDPOINT="https://gateway.example.com/v1"
DIRECT_MODEL="my-model"
configure_pi_provider
check "direct-openai-compatible: baseUrl is still the real gateway" \
    "https://gateway.example.com/v1" "$(jq -r '.providers["direct-openai-compatible"].baseUrl' "${AGENT_DIR}/models.json" 2>/dev/null)"

echo
echo "=== DIRECT_HEADROOM=1, proxy live - routed providers point at loopback ==="
if ! command -v headroom >/dev/null 2>&1; then
    echo "  SKIPPED: no headroom on PATH - run this inside the worker image for this section"
else
    reset_home
    DIRECT_PROVIDER=anthropic
    start_headroom; check "start_headroom accepts" 0 $?
    configure_pi_provider
    check "anthropic: baseUrl is loopback" \
        "http://127.0.0.1:${HEADROOM_PORT}" "$(jq -r '.providers.anthropic.baseUrl' "${AGENT_DIR}/models.json" 2>/dev/null)"
    stop_and_reap

    reset_home
    DIRECT_PROVIDER=openai
    start_headroom
    configure_pi_provider
    check "openai: baseUrl is loopback with /v1" \
        "http://127.0.0.1:${HEADROOM_PORT}/v1" "$(jq -r '.providers.openai.baseUrl' "${AGENT_DIR}/models.json" 2>/dev/null)"
    stop_and_reap

    reset_home
    DIRECT_PROVIDER=direct-openai-compatible
    DIRECT_PROVIDER_ENDPOINT="https://gateway.example.com/v1"
    DIRECT_MODEL="my-model"
    HEADROOM_ARGS=(--openai-api-url "${DIRECT_PROVIDER_ENDPOINT%/v1}")
    start_headroom "${HEADROOM_ARGS[@]}"
    configure_pi_provider
    check "direct-openai-compatible: baseUrl is loopback with /v1" \
        "http://127.0.0.1:${HEADROOM_PORT}/v1" "$(jq -r '.providers["direct-openai-compatible"].baseUrl' "${AGENT_DIR}/models.json" 2>/dev/null)"
    stop_and_reap

    reset_home
    DIRECT_PROVIDER=azure-openai-responses
    DIRECT_PROVIDER_ENDPOINT="https://my-resource.openai.azure.com"
    unset AZURE_OPENAI_BASE_URL
    HEADROOM_ARGS=(--openai-api-url "${DIRECT_PROVIDER_ENDPOINT%/}/openai")
    start_headroom "${HEADROOM_ARGS[@]}"
    configure_pi_provider
    check "azure: AZURE_OPENAI_BASE_URL is loopback with /v1" \
        "http://127.0.0.1:${HEADROOM_PORT}/v1" "${AZURE_OPENAI_BASE_URL:-}"
    check "azure: start_headroom was passed the resource's /openai path" \
        "--openai-api-url https://my-resource.openai.azure.com/openai" "${HEADROOM_ARGS[*]}"
    stop_and_reap
fi

echo
if [[ $failures -eq 0 ]]; then
    echo "All cases behaved - anthropic/openai/direct-openai-compatible/azure-openai-responses route through Headroom on Pi when it is up, and every provider falls back to direct exactly as before when it is not."
else
    echo "${failures} case(s) failed."
fi
rm -rf "$WORK"
exit $((failures > 0))
