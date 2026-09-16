#!/usr/bin/env bash
# Reproduces the production incident - a worker container that is stopped or evicted (SIGTERM,
# then SIGKILL when the grace period runs out) took every commit the agent had made with it,
# because push_workspaces was only ever reached from the two normal-completion paths - and shows
# that the termination traps now in entrypoint.sh get those commits onto the remote instead.
#
# Runs the real entrypoint.sh, not a reimplementation of it. The only things changed are the
# hardcoded /workspace path, which has to move somewhere writable outside a container, and stubs
# on PATH standing in for the agent CLI and rtk. The script runs under `env -i` so it sees only
# the variables named here - the machine this spec runs on may itself be a worker, and a leaked
# DIRECT_CALLBACK_URL would report a spec run to a real Direct.
#
# Exits non-zero when the fix is not in effect.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
ROOT="${HERE}/termtest"
chmod -R u+w "$ROOT" 2>/dev/null; rm -rf "$ROOT"; mkdir -p "$ROOT"

BRANCH="direct/spec-termination"
FAILURES=0

# git commit (and fetch/am/rebase/merge, but not clone/checkout/push - verified against git's own
# source, builtin/{fetch,am,commit,rebase,merge}.c calling run_auto_maintenance()) shells out to a
# *separate, backgrounded* `git maintenance run --auto --detach` by default - the same mechanism
# #701 root-caused for the mirror-compaction spec's FileNotFoundException on
# objects/maintenance.lock. Every commit below runs it, and on the shared, more heavily loaded
# runner this exercises on (unlike a local run) the detached maintenance process can apparently
# still be settling when the calling script's very next line runs, which is exactly what stalls
# `touch "$ROOT/committed"` long enough for start_worker's poll below to give up. Disabled on every
# commit here for the same reason RepositoryMirrorMaintenance disables it on its own git commands:
# nothing in this throwaway, single-use repo benefits from opportunistic background housekeeping.
GIT_HERMETIC=(-c maintenance.auto=false -c gc.auto=0)

# The remote the worker clones from and is expected to push back to.
git init -q --bare -b main "$ROOT/upstream.git"
git init -q -b main "$ROOT/seed"
git -C "$ROOT/seed" config user.email a@b.c; git -C "$ROOT/seed" config user.name t
echo "real behavior lives here" > "$ROOT/seed/file.cs"
git -C "$ROOT/seed" add .; git "${GIT_HERMETIC[@]}" -C "$ROOT/seed" commit -qm init
git -C "$ROOT/seed" push -q "$ROOT/upstream.git" HEAD:refs/heads/main

mkdir -p "$ROOT/bin"
printf '#!/bin/sh\nexit 0\n' > "$ROOT/bin/rtk"

# Stands in for the agent CLI: commits into the checkout and then stays alive, exactly like a
# session that is still working when the container is told to go away.
cat > "$ROOT/bin/claude-that-keeps-working" <<STUB
#!/usr/bin/env bash
git -c maintenance.auto=false -c gc.auto=0 -C "$ROOT/workspace" -c user.email=a@b.c -c user.name=agent commit -q --allow-empty -m "Work the agent did"
touch "$ROOT/committed"
while [[ ! -f "$ROOT/stop" ]]; do sleep 0.2; done
STUB

# Stands in for a session that finishes on its own: commits, emits the one stream-json event the
# harness reads its result out of, and exits 0.
cat > "$ROOT/bin/claude-that-finishes" <<STUB
#!/usr/bin/env bash
git -c maintenance.auto=false -c gc.auto=0 -C "$ROOT/workspace" -c user.email=a@b.c -c user.name=agent commit -q --allow-empty -m "Work the agent did"
touch "$ROOT/committed"
printf '%s\n' '{"type":"result","result":"all done","usage":{"input_tokens":1,"output_tokens":2},"total_cost_usd":0.5,"duration_ms":10}'
STUB
chmod +x "$ROOT/bin/rtk" "$ROOT/bin/claude-that-keeps-working" "$ROOT/bin/claude-that-finishes"

# Runs the real entrypoint - optionally with lines matching `strip` removed, to reproduce the old
# behavior - and leaves it running in the background as $WORKER.
start_worker() {
    local label="$1" agent="$2" strip="${3:-}"
    SCRIPT="$ROOT/entrypoint-${label}.sh"

    sed "s#/workspace#${ROOT}/workspace#g" "$ENTRYPOINT" > "$SCRIPT"
    if [[ -n "$strip" ]]; then
        sed -i'' -e "/${strip}/d" "$SCRIPT"
    fi
    rm -rf "$ROOT/workspace" "$ROOT/home" "$ROOT/committed" "$ROOT/stop"
    rm -f /tmp/claude-in /tmp/claude-exit /tmp/claude-stream.jsonl
    mkdir -p "$ROOT/home"
    cp "$ROOT/bin/$agent" "$ROOT/bin/claude"
    git -C "$ROOT/upstream.git" update-ref -d "refs/heads/${BRANCH}" 2>/dev/null

    env -i \
        HOME="$ROOT/home" \
        PATH="$ROOT/bin:/usr/local/bin:/usr/bin:/bin" \
        DIRECT_REPOSITORY_URL="$ROOT/upstream.git" \
        DIRECT_BRANCH="$BRANCH" \
        DIRECT_WORK_ID="spec" \
        DIRECT_PROMPT="do the work" \
        bash "$SCRIPT" > "$ROOT/${label}.log" 2>&1 &
    WORKER=$!

    local waited=0
    while [[ ! -f "$ROOT/committed" && $waited -lt 600 ]]; do sleep 0.1; waited=$((waited + 1)); done
    if [[ -f "$ROOT/committed" ]]; then
        return 0
    fi
    diagnose_failure "$label"
    return 1
}

# Temporary, generous diagnostics for a runner-only failure that has not reproduced in any local
# environment tried so far (Alpine, and Ubuntu 24.04 + git 2.55.0 via ppa:git-core/ppa - see the
# investigation this is part of). Dumps everything plausibly relevant when start_worker's own poll
# gives up, so the next runner round-trip has real evidence instead of another guess. Safe to leave
# in permanently if it turns out cheap and useful; remove once the cause is found.
diagnose_failure() {
    local label="$1"
    echo "  --- diagnostics for '${label}' ---"

    echo "  worker process $WORKER: $(kill -0 "$WORKER" 2>/dev/null && echo "alive" || echo "not running")"

    echo "  PATH the worker ran with: $ROOT/bin:/usr/local/bin:/usr/bin:/bin"
    local bin
    for bin in bash git jq claude rtk time; do
        local resolved
        resolved=$(PATH="$ROOT/bin:/usr/local/bin:/usr/bin:/bin" command -v "$bin" 2>/dev/null)
        echo "    ${bin}: ${resolved:-NOT FOUND}"
    done
    echo "  git --version: $(git --version 2>&1)"
    echo "  bash --version: $(bash --version 2>&1 | head -1)"
    echo "  \$ROOT/bin contents:"
    ls -la "$ROOT/bin" 2>&1 | sed 's/^/    /'

    echo "  \$ROOT/${label}.log (entrypoint's own stdout+stderr, last 60 lines):"
    if [[ -s "$ROOT/${label}.log" ]]; then
        tail -60 "$ROOT/${label}.log" | sed 's/^/    /'
    else
        echo "    (empty or missing)"
    fi

    echo "  \$ROOT/workspace: $([[ -d "$ROOT/workspace" ]] && echo "exists" || echo "missing")"
    if [[ -d "$ROOT/workspace/.git" ]]; then
        echo "    git log: $(git -C "$ROOT/workspace" log --oneline --all 2>&1 | tr '\n' '; ')"
    fi

    echo "  processes matching this run right now:"
    ps -eo pid,ppid,stat,etime,cmd 2>/dev/null | grep -E "${SCRIPT##*/}|claude|entrypoint" | grep -v grep | sed 's/^/    /'

    echo "  /tmp/claude-* state:"
    ls -la /tmp/claude-in /tmp/claude-exit /tmp/claude-stream.jsonl /tmp/mcp-config.json 2>&1 | sed 's/^/    /'
}

await_worker() {
    local waited=0
    while kill -0 "$WORKER" 2>/dev/null && [[ $waited -lt 600 ]]; do sleep 0.1; waited=$((waited + 1)); done
    touch "$ROOT/stop"
    wait "$WORKER" 2>/dev/null
    WORKER_STATUS=$?
    ! kill -0 "$WORKER" 2>/dev/null
}

pushed() {
    git -C "$ROOT/upstream.git" rev-parse --verify --quiet "refs/heads/${BRANCH}" >/dev/null
}

fail_case() {
    echo "  RESULT: $1 - see $ROOT"
    FAILURES=$((FAILURES + 1))
}

echo "=== OLD: nothing reaches push_workspaces when the container is stopped ==="
if ! start_worker old claude-that-keeps-working "^trap "; then
    fail_case "the agent never got as far as committing"
else
    kill -TERM "$WORKER" 2>/dev/null
    if ! await_worker; then
        fail_case "the worker did not exit on SIGTERM"
        kill -KILL "$WORKER" 2>/dev/null
    elif pushed; then
        fail_case "pushed anyway, so this case no longer reproduces the failure"
    else
        echo "  RESULT: ${BRANCH} never reached the remote - this is the production failure"
    fi
fi

echo
echo "=== NEW: a stopped container pushes before it goes away ==="
if ! start_worker new claude-that-keeps-working; then
    fail_case "the agent never got as far as committing"
else
    kill -TERM "$WORKER" 2>/dev/null
    if ! await_worker; then
        fail_case "the worker did not exit on SIGTERM"
        kill -KILL "$WORKER" 2>/dev/null
    elif ! pushed; then
        fail_case "${BRANCH} never reached the remote, so the work was lost"
    else
        echo "  RESULT: pushed - $(git -C "$ROOT/upstream.git" log --oneline -1 "$BRANCH")"
    fi
fi

echo
echo "=== NEW: a session that finishes on its own still pushes and still exits 0 ==="
if ! start_worker finishing claude-that-finishes; then
    fail_case "the agent never got as far as committing"
else
    if ! await_worker; then
        fail_case "the worker never exited"
        kill -KILL "$WORKER" 2>/dev/null
    elif [[ $WORKER_STATUS -ne 0 ]]; then
        fail_case "the worker exited ${WORKER_STATUS} rather than 0"
    elif ! pushed; then
        fail_case "${BRANCH} never reached the remote"
    elif [[ $(grep -c "Pushed ${BRANCH}" "$ROOT/finishing.log") -ne 1 ]]; then
        fail_case "pushed $(grep -c "Pushed ${BRANCH}" "$ROOT/finishing.log") times rather than once"
    else
        echo "  RESULT: pushed once, exited 0 - $(git -C "$ROOT/upstream.git" log --oneline -1 "$BRANCH")"
    fi
fi

echo
if [[ $FAILURES -eq 0 ]]; then
    echo "OK"
else
    echo "FAILED (${FAILURES})"
fi
exit "$FAILURES"
