#!/usr/bin/env bash
# Exercises entrypoint.sh's start_headroom/stop_headroom (issue #556) against every way the proxy
# can be missing or broken, and shows that each one leaves the run to carry on rather than failing
# it. That fail-open contract is the whole reason a compression layer is allowed in the request path
# of an agent session at all, so it is the thing worth proving.
#
# The functions are not reimplemented here - they are lifted verbatim out of entrypoint.sh and
# sourced, so this exercises the real code rather than a copy of it that can drift.
#
# Run it directly: Source/AgentHarnesses/for_entrypoint/headroom-fails-open.sh
# The last case needs a real `headroom` on PATH (the worker image has one); without it that case is
# reported as skipped rather than silently passing.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
WORK="${HERE}/headroomtest"
rm -rf "$WORK"; mkdir -p "$WORK/bin"

log() { printf '[agent-harness] %s\n' "$*"; }

# From the HEADROOM_PORT declaration down to the end of stop_headroom - the whole unit as it stands
# in entrypoint.sh.
awk '/^HEADROOM_PORT=/ { inside = 1 }
     inside { print }
     /^stop_headroom\(\)/ { last = 1 }
     last && /^}$/ { exit }' "$ENTRYPOINT" > "$WORK/headroom-functions.sh"
grep -q 'start_headroom()' "$WORK/headroom-functions.sh" || { echo "FAILED to lift start_headroom out of entrypoint.sh"; exit 1; }
grep -q 'stop_headroom()' "$WORK/headroom-functions.sh" || { echo "FAILED to lift stop_headroom out of entrypoint.sh"; exit 1; }
# shellcheck source=/dev/null
. "$WORK/headroom-functions.sh"

# A port nothing else on the machine is likely to be using, so a stale proxy elsewhere cannot make
# a failing case look like a passing one.
HEADROOM_PORT=18787

failures=0
check() {
    local what="$1" expected="$2" actual="$3"
    if [[ "$expected" == "$actual" ]]; then
        echo "  PASS: ${what}"
    else
        echo "  FAIL: ${what} (expected ${expected}, got ${actual})"
        failures=$((failures + 1))
    fi
}

echo "=== Not asked for: DIRECT_HEADROOM unset ==="
unset DIRECT_HEADROOM
start_headroom; check "start_headroom declines" 1 $?
check "nothing was started" "" "$HEADROOM_PID"

echo
echo "=== Asked for, but not in the image ==="
DIRECT_HEADROOM=1
PATH_BEFORE="$PATH"
PATH="$WORK/bin"
start_headroom; check "start_headroom declines" 1 $?
check "nothing was started" "" "$HEADROOM_PID"
PATH="$PATH_BEFORE"

echo
echo "=== Asked for, but the proxy dies on startup (the port is taken, say) ==="
cat > "$WORK/bin/headroom" <<'FAKE'
#!/usr/bin/env bash
echo "ERROR: [Errno 98] address already in use" >&2
exit 1
FAKE
chmod +x "$WORK/bin/headroom"
PATH="$WORK/bin:$PATH_BEFORE"
started_at=$SECONDS
start_headroom; check "start_headroom declines" 1 $?
check "nothing is left running" "" "$HEADROOM_PID"
# The kill -0 check is what makes this immediate; without it a dead proxy costs the full readiness
# wait before the run gives up on it.
if [[ $((SECONDS - started_at)) -lt 10 ]]; then
    echo "  PASS: gave up as soon as the process was gone ($((SECONDS - started_at))s)"
else
    echo "  FAIL: waited $((SECONDS - started_at))s for a process that had already exited"
    failures=$((failures + 1))
fi
PATH="$PATH_BEFORE"

echo
echo "=== Asked for, and the real proxy is here ==="
if ! command -v headroom >/dev/null 2>&1; then
    echo "  SKIPPED: no headroom on PATH - run this inside the worker image for this case"
else
    start_headroom; check "start_headroom accepts" 0 $?
    if [[ -n "$HEADROOM_PID" ]] && kill -0 "$HEADROOM_PID" 2>/dev/null; then
        echo "  PASS: the proxy is running"
    else
        echo "  FAIL: start_headroom reported ready with no running proxy"
        failures=$((failures + 1))
    fi
    curl -fsS -m 5 "http://127.0.0.1:${HEADROOM_PORT}/readyz" >/dev/null 2>&1 \
        && echo "  PASS: /readyz answers" \
        || { echo "  FAIL: /readyz does not answer"; failures=$((failures + 1)); }
    pid="$HEADROOM_PID"
    stop_headroom
    check "stop_headroom clears the pid" "" "$HEADROOM_PID"
    sleep 1
    kill -0 "$pid" 2>/dev/null \
        && { echo "  FAIL: the proxy is still running after stop_headroom"; failures=$((failures + 1)); } \
        || echo "  PASS: the proxy is stopped"
fi

echo
if [[ $failures -eq 0 ]]; then
    echo "All cases behaved - a Headroom that is missing, broken or slow never fails the run."
else
    echo "${failures} case(s) failed."
fi
rm -rf "$WORK"
exit $((failures > 0))
