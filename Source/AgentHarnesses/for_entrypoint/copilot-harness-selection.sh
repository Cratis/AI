#!/usr/bin/env bash
# Pins entrypoint.sh's three-way DIRECT_HARNESS selection.
#
# This is the one edit in the Copilot harness work that does not fail loudly when it is wrong: before
# the third arm existed, DIRECT_HARNESS was "pi" or it was Claude Code, so an unrecognized value -
# "copilot" included - silently ran Claude against somebody's repository with a credential minted for
# a different vendor. What this fixture asserts is therefore as much about the values that must NOT
# move as about the one that must: only the exact string "copilot" reaches run_copilot, only the
# exact string "pi" reaches run_pi, and everything else - unset, empty, "claude-code", a typo, a
# value with different casing or stray whitespace - still lands on Claude Code.
#
# The selection is lifted verbatim out of entrypoint.sh rather than reimplemented, so it exercises
# the shipped code and cannot drift from it.
#
# Run it directly: Source/AgentHarnesses/for_entrypoint/copilot-harness-selection.sh
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
WORK="${HERE}/copilot-selection"
rm -rf "$WORK"; mkdir -p "$WORK"

SELECTION="$WORK/selection.sh"
awk '/^case "\$\{DIRECT_HARNESS:-\}" in$/ { inside = 1 }
     inside { print }
     inside && /^esac$/ { exit }' "$ENTRYPOINT" > "$SELECTION"
grep -q 'run_copilot' "$SELECTION" || { echo "FAILED to lift the harness selection out of entrypoint.sh"; exit 1; }

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

# The three arms are replaced by something that only records which one ran, so the fixture can run
# the real selection without running a real agent.
run_claude_code() { printf 'claude'; }
run_pi() { printf 'pi'; }
run_copilot() { printf 'copilot'; }

selected() {
    if [[ $# -eq 0 ]]; then
        unset DIRECT_HARNESS
    else
        export DIRECT_HARNESS="$1"
    fi
    # shellcheck source=/dev/null
    . "$SELECTION"
}

echo "=== The harness each DIRECT_HARNESS value selects ==="
check "unset runs Claude Code" "claude" "$(selected)"
check "empty runs Claude Code" "claude" "$(selected '')"
check "claude-code runs Claude Code" "claude" "$(selected 'claude-code')"
check "pi runs Pi" "pi" "$(selected 'pi')"
check "copilot runs Copilot" "copilot" "$(selected 'copilot')"

echo
echo "=== Values that must not become another harness ==="
check "Copilot with different casing does not run Copilot" "claude" "$(selected 'Copilot')"
check "copilot with stray whitespace does not run Copilot" "claude" "$(selected ' copilot')"
check "a typo does not run Copilot" "claude" "$(selected 'coplot')"
check "copilot-cli does not run Copilot" "claude" "$(selected 'copilot-cli')"
check "an unrelated value does not run Pi" "claude" "$(selected 'something-else')"

rm -rf "$WORK"

echo
if [[ $failures -eq 0 ]]; then
    echo "All harness-selection checks passed"
else
    echo "${failures} harness-selection check(s) failed"
fi
exit "$failures"
