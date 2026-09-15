#!/usr/bin/env bash
# Exercises the CPU/memory measurement helpers entrypoint.sh added for Cratis/Stagehand#638:
#   - claude_cpu_seconds_from_time_file / claude_memory_bytes_from_time_file, which parse GNU
#     `time -v`'s report for the Claude CLI path.
#   - sample_pi_usage, which samples /proc/$pid/{status,stat} for the Pi CLI path (Pi's real PID
#     cannot be wrapped with `time` without breaking the TERM/INT signal traps - see the comment on
#     sample_pi_usage in entrypoint.sh).
#
# The functions are extracted verbatim out of entrypoint.sh (rather than reimplemented here) so this
# actually exercises the shipped code, matching checkout-can-commit.sh's self-contained style. A
# failure printed at the end means one of the parsers produced something that is not a sane number.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENTRYPOINT="$ROOT/entrypoint.sh"
FAILED=0

extract_function() {
    local name="$1"
    awk -v fn="$name" '
        $0 ~ "^" fn "\\(\\)" { found = 1 }
        found { print }
        found && /^}/ { exit }
    ' "$ENTRYPOINT"
}

# shellcheck disable=SC1090
source <(extract_function claude_cpu_seconds_from_time_file)
# shellcheck disable=SC1090
source <(extract_function claude_memory_bytes_from_time_file)
# shellcheck disable=SC1090
source <(extract_function sample_pi_usage)

check() {
    local label="$1" expected="$2" actual="$3"
    if [[ "$actual" == "$expected" ]]; then
        echo "  PASS: ${label} = ${actual}"
    else
        echo "  FAIL: ${label} expected ${expected}, got ${actual}"
        FAILED=1
    fi
}

echo "=== claude_cpu_seconds_from_time_file / claude_memory_bytes_from_time_file ==="

TIME_FILE="$(mktemp)"
cat > "$TIME_FILE" <<'EOF'
	Command being timed: "claude -p --input-format stream-json"
	User time (seconds): 12.34
	System time (seconds): 1.66
	Percent of CPU this job got: 87%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:14.23
	Maximum resident set size (kbytes): 524288
	Exit status: 0
EOF

check "CPU seconds from a real time -v report" "14.000" "$(claude_cpu_seconds_from_time_file "$TIME_FILE")"
check "Memory bytes from a real time -v report" "536870912" "$(claude_memory_bytes_from_time_file "$TIME_FILE")"

MISSING_FILE="/tmp/does-not-exist-$$"
check "CPU seconds when the report file is missing" "0" "$(claude_cpu_seconds_from_time_file "$MISSING_FILE")"
check "Memory bytes when the report file is missing" "0" "$(claude_memory_bytes_from_time_file "$MISSING_FILE")"

rm -f "$TIME_FILE"

echo
echo "=== sample_pi_usage ==="

# A real, running process with a real /proc/$pid - a busy loop burns actual CPU time so the sample
# has something non-zero to observe, rather than asserting only that the code path does not crash.
( for _ in $(seq 1 20000000); do :; done ) &
BUSY_PID=$!

PI_PEAK_MEMORY_BYTES=0
PI_CPU_SECONDS=0
PI_CLK_TCK=$(getconf CLK_TCK 2>/dev/null || echo 100)

for _ in 1 2 3 4 5; do
    sample_pi_usage "$BUSY_PID"
    sleep 0.1
done

wait "$BUSY_PID" 2>/dev/null

if [[ "$PI_PEAK_MEMORY_BYTES" -gt 0 ]]; then
    echo "  PASS: peak memory sampled from a live process (${PI_PEAK_MEMORY_BYTES} bytes)"
else
    echo "  FAIL: peak memory stayed 0 for a live process"
    FAILED=1
fi

if awk -v v="$PI_CPU_SECONDS" 'BEGIN { exit !(v >= 0) }'; then
    echo "  PASS: CPU seconds sampled is a sane non-negative number (${PI_CPU_SECONDS})"
else
    echo "  FAIL: CPU seconds sampled is not a sane number (${PI_CPU_SECONDS})"
    FAILED=1
fi

# A dead PID's /proc entry is gone - the sampler must leave the running totals untouched rather than
# erroring out, since this is called from a polling loop that keeps going until a done marker appears.
PRE_MEMORY="$PI_PEAK_MEMORY_BYTES"
PRE_CPU="$PI_CPU_SECONDS"
sample_pi_usage 999999999
check "Peak memory unchanged when sampling a dead pid" "$PRE_MEMORY" "$PI_PEAK_MEMORY_BYTES"
check "CPU seconds unchanged when sampling a dead pid" "$PRE_CPU" "$PI_CPU_SECONDS"

echo
if [[ $FAILED -eq 0 ]]; then
    echo "All usage-measurement checks passed"
else
    echo "One or more usage-measurement checks FAILED"
fi
exit $FAILED
