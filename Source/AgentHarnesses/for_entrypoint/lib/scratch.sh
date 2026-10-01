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
# A tracked pid is only killed while it is still alive and still a child of this shell, so a pid the
# fixture already waited for (and the kernel has since handed to an unrelated process) is never
# signalled. A fixture that waits for a worker itself should call scratch_untrack_pid afterwards.
#
# Process lookup uses pgrep/pkill. Where they are missing (a minimal container) a one-line warning is
# printed and, on Linux, /proc is walked instead; elsewhere that part of the cleanup is skipped.
#
# Set SPEC_KEEP_SCRATCH=1 to keep the tree for debugging; the path is printed on exit.

SCRATCH_ROOT=""
SCRATCH_PIDS=()
SCRATCH_HAS_PGREP=1
SCRATCH_HAS_PKILL=1

# scratch_create NAME - a fresh scratch root that is never inside the source tree.
scratch_create() {
    local tmp="${TMPDIR:-/tmp}"
    SCRATCH_ROOT="$(mktemp -d "${tmp%/}/entrypoint-${1}.XXXXXX")" || exit 1
    trap scratch_cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM

    command -v pgrep >/dev/null 2>&1 || SCRATCH_HAS_PGREP=0
    command -v pkill >/dev/null 2>&1 || SCRATCH_HAS_PKILL=0
    if [[ $SCRATCH_HAS_PGREP -eq 0 || $SCRATCH_HAS_PKILL -eq 0 ]]; then
        if [[ -r /proc/self/stat ]]; then
            echo "  warning: pgrep/pkill not found - scratch cleanup falls back to walking /proc" >&2
        else
            echo "  warning: pgrep/pkill not found and no /proc - scratch cleanup cannot stop descendant processes" >&2
        fi
    fi
}

# A fixture may define scratch_before_cleanup to call scratch_track_pid for pids kept in variables.

# scratch_track_pid PID - a background process this fixture started; call again for each new one.
scratch_track_pid() {
    [[ -n "${1:-}" ]] && SCRATCH_PIDS+=("$1")
    return 0
}

# scratch_untrack_pid PID - a tracked process this fixture has waited for; it no longer needs cleaning up.
scratch_untrack_pid() {
    local pid="${1:-}" kept=() tracked
    [[ -z "$pid" ]] && return 0
    for tracked in ${SCRATCH_PIDS[@]+"${SCRATCH_PIDS[@]}"}; do
        [[ "$tracked" != "$pid" ]] && kept+=("$tracked")
    done
    SCRATCH_PIDS=(${kept[@]+"${kept[@]}"})
    return 0
}

# Prints the parent pid of PID, or nothing when PID does not exist.
scratch_parent_of() {
    local pid="$1" line rest fields
    if [[ -r "/proc/${pid}/stat" ]]; then
        # The command name in field 2 may contain spaces and parentheses; everything after the last
        # ") " is state, ppid, ...
        read -r line < "/proc/${pid}/stat" 2>/dev/null || return 0
        rest="${line##*) }"
        read -ra fields <<< "$rest"
        echo "${fields[1]:-}"
    else
        ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' '
    fi
}

# True while PID is alive and is a direct child of this shell.
scratch_is_own_child() {
    local pid="$1"
    kill -0 "$pid" 2>/dev/null || return 1
    [[ "$(scratch_parent_of "$pid")" == "$$" ]]
}

# Prints the direct children of PID.
scratch_children() {
    local parent="$1" stat line rest fields pid
    if [[ $SCRATCH_HAS_PGREP -eq 1 ]]; then
        pgrep -P "$parent" 2>/dev/null
    elif [[ -r /proc/self/stat ]]; then
        for stat in /proc/[0-9]*/stat; do
            read -r line < "$stat" 2>/dev/null || continue
            rest="${line##*) }"
            read -ra fields <<< "$rest"
            if [[ "${fields[1]:-}" == "$parent" ]]; then
                pid="${stat#/proc/}"
                echo "${pid%/stat}"
            fi
        done
    fi
}

# Prints pid and every descendant, parents first.
scratch_tree() {
    local pid="$1" child
    echo "$pid"
    for child in $(scratch_children "$pid"); do
        scratch_tree "$child"
    done
}

# Kills every process whose command line mentions the scratch root, except this shell.
scratch_kill_by_path() {
    local needle="${SCRATCH_ROOT}/" cmdline
    if [[ $SCRATCH_HAS_PKILL -eq 1 ]]; then
        pkill -KILL -f -- "$needle" 2>/dev/null
    elif [[ -r /proc/self/stat ]]; then
        local file pid
        for file in /proc/[0-9]*/cmdline; do
            pid="${file#/proc/}"
            pid="${pid%/cmdline}"
            [[ "$pid" == "$$" || "$pid" == "${BASHPID:-}" ]] && continue
            cmdline="$(tr '\0' ' ' < "$file" 2>/dev/null)" || continue
            [[ "$cmdline" == *"$needle"* ]] && kill -KILL "$pid" 2>/dev/null
        done
    fi
    return 0
}

scratch_cleanup() {
    local status=$? pid found victims=()
    # A fixture may run under set -e; a cleanup step that finds nothing to do must not abort the rest.
    set +e

    # A fixture may define this to track pids held in variables that change over its run.
    if declare -F scratch_before_cleanup >/dev/null; then scratch_before_cleanup; fi
    if [[ ${#SCRATCH_PIDS[@]} -gt 0 ]]; then
        # Collect the whole tree before killing anything: once a parent is gone its children are
        # reparented and can no longer be found through it.
        # Only our own live children: a pid that has exited may already belong to something else.
        for pid in "${SCRATCH_PIDS[@]}"; do
            scratch_is_own_child "$pid" || continue
            while read -r found; do victims+=("$found"); done < <(scratch_tree "$pid")
        done
        [[ ${#victims[@]} -gt 0 ]] && kill -KILL "${victims[@]}" 2>/dev/null
        for pid in "${SCRATCH_PIDS[@]}"; do wait "$pid" 2>/dev/null; done
    fi
    # Anything else that was started from inside the scratch tree (a stub agent, a proxy).
    [[ -n "$SCRATCH_ROOT" ]] && scratch_kill_by_path

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
