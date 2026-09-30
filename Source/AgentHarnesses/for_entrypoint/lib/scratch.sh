#!/usr/bin/env bash
# Scratch-tree and background-process hygiene for the entrypoint fixtures. Sourced, never run: the CI
# loop only runs the top-level *.sh files, which is why this lives in lib/.
#
#   source "${HERE}/lib/scratch.sh"
#   scratch_create corpustest        # sets SCRATCH_ROOT to a fresh mktemp -d and installs the EXIT trap
#   ROOT="$SCRATCH_ROOT"
#   ... background_thing & ; scratch_track_pid $!
#
# On exit - normal, failed, or interrupted by INT/TERM - the trap kills every tracked background
# process and everything below it, waits for them, then removes the tree. A fixture's own kill of a
# worker only reaches the script, never the stub agent it started, which is how entrypoint-*.sh
# processes used to outlive a run with PID 1 as their parent.
#
# Set SPEC_KEEP_SCRATCH=1 to keep the tree for debugging; the path is printed on exit.

SCRATCH_ROOT=""
SCRATCH_PIDS=()

# scratch_create NAME - a fresh scratch root that is never inside the source tree.
scratch_create() {
    local tmp="${TMPDIR:-/tmp}"
    SCRATCH_ROOT="$(mktemp -d "${tmp%/}/entrypoint-${1}.XXXXXX")" || exit 1
    trap scratch_cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
}

# A fixture may define scratch_before_cleanup to call scratch_track_pid for pids kept in variables.

# scratch_track_pid PID - a background process this fixture started; call again for each new one.
scratch_track_pid() {
    [[ -n "${1:-}" ]] && SCRATCH_PIDS+=("$1")
    return 0
}

# Prints pid and every descendant, parents first.
scratch_tree() {
    local pid="$1" child
    echo "$pid"
    for child in $(pgrep -P "$pid" 2>/dev/null); do
        scratch_tree "$child"
    done
}

scratch_cleanup() {
    local status=$? pid victims=()
    # A fixture may run under set -e; a cleanup step that finds nothing to do must not abort the rest.
    set +e

    # A fixture may define this to track pids held in variables that change over its run.
    if declare -F scratch_before_cleanup >/dev/null; then scratch_before_cleanup; fi
    if [[ ${#SCRATCH_PIDS[@]} -gt 0 ]]; then
        # Collect the whole tree before killing anything: once a parent is gone its children are
        # reparented and can no longer be found through it.
        for pid in "${SCRATCH_PIDS[@]}"; do
            while read -r found; do victims+=("$found"); done < <(scratch_tree "$pid")
        done
        [[ ${#victims[@]} -gt 0 ]] && kill -KILL "${victims[@]}" 2>/dev/null
        for pid in "${SCRATCH_PIDS[@]}"; do wait "$pid" 2>/dev/null; done
    fi
    # Anything else that was started from inside the scratch tree (a stub agent, a proxy).
    [[ -n "$SCRATCH_ROOT" ]] && pkill -KILL -f -- "${SCRATCH_ROOT}/" 2>/dev/null

    if [[ -n "$SCRATCH_ROOT" ]]; then
        if [[ "${SPEC_KEEP_SCRATCH:-}" == "1" ]]; then
            echo "  scratch tree kept: ${SCRATCH_ROOT}"
        else
            # Bare repositories hold read-only objects.
            chmod -R u+w "$SCRATCH_ROOT" 2>/dev/null
            rm -rf "$SCRATCH_ROOT"
        fi
    fi
    return "$status"
}
