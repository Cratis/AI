#!/usr/bin/env bash
# Runs every for_entrypoint/*.sh fixture and exits non-zero when any of them failed. This is the one
# command CI (publish.yml) and a developer machine both use.
#
#   bash Source/AgentHarnesses/run-entrypoint-fixtures.sh            # all fixtures
#   bash Source/AgentHarnesses/run-entrypoint-fixtures.sh usage-measurement.sh   # only these
#   FIXTURE_JOBS=4 bash Source/AgentHarnesses/run-entrypoint-fixtures.sh         # concurrency (default: CPU count)
#
# A fixture is hermetic (its own mktemp scratch tree, removed on exit), so fixtures run side by side.
# Two header markers in a fixture's leading comment change how the runner treats it:
#
#   # fixture-serial: <reason>          - runs the real entrypoint.sh, which writes fixed /tmp paths
#                                         (/tmp/claude-*, /tmp/pi-*, ...); these share one lane and run
#                                         one after another, beside the concurrent fixtures.
#   # fixture-requires-linux: <reason>  - needs /proc, GNU tools or bash >= 4.4. On a non-Linux machine
#                                         it is reported SKIPPED with the reason. On Linux, and whenever
#                                         CI / GITHUB_ACTIONS is set, the marker is ignored: the fixture
#                                         runs and fails if its prerequisite is missing. Run those in
#                                         ubuntu to cover them from another OS:
#     docker run --rm -v "$PWD:/repo" -w /repo ubuntu:24.04 bash -c \
#       'apt-get update -qq && apt-get install -y -qq git jq curl python3 nodejs procps time >/dev/null && \
#        git config --global user.email s@s && git config --global user.name s && \
#        git config --global init.defaultBranch main && bash Source/AgentHarnesses/run-entrypoint-fixtures.sh'
#
# Every fixture's exit status is kept: a failure prints its full output and makes the run exit 1, a
# fixture that could not be started or a run that found no fixtures exits 2. The last line reports the
# counts, so "0 run" can never read as a pass.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
FIXTURES="${HERE}/for_entrypoint"
JOBS="${FIXTURE_JOBS:-$( (nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4) | head -1)}"
[[ "$JOBS" =~ ^[1-9][0-9]*$ ]] || { echo "FIXTURE_JOBS must be a positive integer, got '${JOBS}'" >&2; exit 2; }

if [[ $# -gt 0 ]]; then
    names=("$@")
else
    names=()
    for path in "${FIXTURES}"/*.sh; do names+=("$(basename "$path")"); done
fi
if [[ ${#names[@]} -eq 0 || ! -f "${FIXTURES}/${names[0]}" ]]; then
    echo "No entrypoint fixtures found under ${FIXTURES}" >&2
    exit 2
fi

# The skip is a developer-machine convenience only: never on Linux, never in CI.
can_skip=0
if [[ "$(uname -s)" != Linux && -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]]; then can_skip=1; fi

marker() { sed -n "s/^# $1: *//p" "${FIXTURES}/$2" | head -1; }

OUT="$(mktemp -d "${TMPDIR:-/tmp}/entrypoint-fixtures.XXXXXX")" || exit 2
trap 'rm -rf "$OUT"' EXIT

run_one() {
    local name="$1" started=$SECONDS
    bash "${FIXTURES}/${name}" > "${OUT}/${name}.log" 2>&1
    echo "$?" > "${OUT}/${name}.status"
    echo "$((SECONDS - started))" > "${OUT}/${name}.seconds"
}

run_serial_lane() {
    local name
    for name in "$@"; do run_one "$name"; done
}

parallel=()
serial=()
skipped=()
for name in "${names[@]}"; do
    if [[ ! -f "${FIXTURES}/${name}" ]]; then echo "No such fixture: ${name}" >&2; exit 2; fi
    reason="$(marker fixture-requires-linux "$name")"
    if [[ -n "$reason" && $can_skip -eq 1 ]]; then
        skipped+=("${name}|${reason}")
    elif [[ -n "$(marker fixture-serial "$name")" ]]; then
        serial+=("$name")
    else
        parallel+=("$name")
    fi
done

started=$SECONDS
if [[ ${#serial[@]} -gt 0 ]]; then run_serial_lane "${serial[@]}" & fi
for name in ${parallel[@]+"${parallel[@]}"}; do
    while [[ "$(jobs -rp | wc -l | tr -d ' ')" -ge "$JOBS" ]]; do sleep 0.2; done
    run_one "$name" &
done
wait

passed=0
failed=0
for name in "${names[@]}"; do
    [[ -f "${OUT}/${name}.status" ]] || continue
    status="$(cat "${OUT}/${name}.status")"
    echo "::group::${name}"
    if [[ "$status" == 0 ]]; then
        echo "PASS: ${name} ($(cat "${OUT}/${name}.seconds") s)"
        passed=$((passed + 1))
    else
        cat "${OUT}/${name}.log"
        echo "::error::FAILED: ${name} (exit ${status})"
        failed=$((failed + 1))
    fi
    echo "::endgroup::"
done
for entry in ${skipped[@]+"${skipped[@]}"}; do
    echo "SKIPPED: ${entry%%|*} - ${entry#*|} (not Linux; runs unconditionally on Linux and in CI)"
done

ran=$((passed + failed))
echo "Entrypoint fixtures: ${ran} run, ${passed} passed, ${failed} failed, ${#skipped[@]} skipped, $((SECONDS - started)) s"
if [[ $ran -ne $((${#names[@]} - ${#skipped[@]})) ]]; then
    echo "::error::Expected $((${#names[@]} - ${#skipped[@]})) fixtures to report, got ${ran}" >&2
    exit 2
fi
[[ $failed -eq 0 ]]
