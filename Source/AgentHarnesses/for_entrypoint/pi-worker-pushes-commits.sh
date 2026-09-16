#!/usr/bin/env bash
# The Pi harness counterpart to terminated-worker-pushes-commits.sh, covering the path a ChatGPT
# subscription runs through: Pi's own built-in openai-codex provider, seeded from the OAuth record
# the Direct hands the container.
#
# Three things are checked:
#
#   1. configure_pi_provider() seeds ~/.pi/agent/auth.json from DIRECT_PI_OAUTH_CREDENTIAL, under
#      the provider id, in the shape Pi's own credential store expects. Getting this wrong does not
#      fail loudly - Pi simply reports credentials_not_configured and the session never authenticates.
#   2. A session that finishes pushes its branch exactly once and exits 0, so work started remotely
#      lands on the remote as something a pull request can be opened from.
#   3. A container stopped mid-session (SIGTERM, then SIGKILL when the grace period runs out) still
#      pushes the commits the agent made, rather than taking them with it.
#
# Runs the real entrypoint.sh, not a reimplementation. The only things changed are the hardcoded
# /workspace path, which has to move somewhere writable outside a container, and stubs on PATH
# standing in for the agent CLI and rtk. It runs under `env -i` so it sees only the variables named
# here - the machine this spec runs on may itself be a worker, and a leaked DIRECT_CALLBACK_URL
# would report a spec run to a real Direct.
#
# Needs bash >= 4.4 and GNU date, so it is a Linux spec - on macOS `env -i` resolves bash to /bin/bash
# 3.2, where the harnesses' empty "${ARRAY[@]}" expansions trip `set -u`. Run it in a container:
#   docker run --rm -v "$PWD/Source/AgentHarnesses:/h" -w /h alpine:3 sh -c \
#     "apk add --no-cache bash git jq && git config --global user.email s@s && \
#      git config --global user.name s && git config --global init.defaultBranch main && \
#      bash for_entrypoint/pi-worker-pushes-commits.sh"
#
# Exits non-zero when the behavior is not in effect.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
ROOT="${HERE}/pitest"
chmod -R u+w "$ROOT" 2>/dev/null; rm -rf "$ROOT"; mkdir -p "$ROOT"

BRANCH="direct/spec-pi"
CREDENTIAL='{"type":"oauth","access":"tok","refresh":"rt","expires":4102444800000,"accountId":"acct-1"}'
FAILURES=0

# git commit shells out to a *separate, backgrounded* `git maintenance run --auto --detach` by
# default (verified against git's own source - builtin/commit.c calls run_auto_maintenance(); clone,
# checkout and push do not) - the same mechanism #701 root-caused for the mirror-compaction spec's
# FileNotFoundException on objects/maintenance.lock, and terminated-worker-pushes-commits.sh's own
# runner-only flake. Disabled on every commit here for the same reason: nothing in this throwaway,
# single-use repo benefits from opportunistic background housekeeping.
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

# Stands in for `pi --mode rpc`: commits, then writes the events run_pi() reads a finished session
# out of - a settled turn and the two responses it keys the final text and usage off, by the ids it
# asks for them under.
#
# It emits those responses itself rather than waiting to be asked. run_pi() sends the two follow-up
# commands back down the same FIFO the stub reads from, and that FIFO's only other writer is the
# feeder, which reaches EOF immediately here because a spec runner has no interactive stdin - so a
# stub that waited to be asked would race the feeder's exit and lose. The real CLI does not, and this
# spec is about the credential and the push, not about re-testing Pi's own RPC handshake.
cat > "$ROOT/bin/pi-that-finishes" <<STUB
#!/usr/bin/env bash
git -c maintenance.auto=false -c gc.auto=0 -C "$ROOT/workspace" -c user.email=a@b.c -c user.name=agent commit -q --allow-empty -m "Work the agent did"
touch "$ROOT/committed"
printf '%s\n' '{"type":"message_end","message":{"role":"assistant","stopReason":"end_turn"}}'
printf '%s\n' '{"type":"agent_settled"}'
printf '%s\n' '{"type":"response","id":"direct-final-text","command":"get_last_assistant_text","success":true,"data":{"text":"all done"}}'
printf '%s\n' '{"type":"response","id":"direct-final-stats","command":"get_session_stats","success":true,"data":{"tokens":{"input":10,"output":5},"cost":0.25}}'
# Outlives the events so the consumer subshell reads them all before the process goes away; run_pi()
# kills this once it has what it needs.
sleep 30
STUB

# Stands in for a session that is still working when the container is told to go away.
cat > "$ROOT/bin/pi-that-keeps-working" <<STUB
#!/usr/bin/env bash
git -c maintenance.auto=false -c gc.auto=0 -C "$ROOT/workspace" -c user.email=a@b.c -c user.name=agent commit -q --allow-empty -m "Work the agent did"
touch "$ROOT/committed"
while [[ ! -f "$ROOT/stop" ]]; do sleep 0.2; done
STUB
chmod +x "$ROOT/bin/rtk" "$ROOT/bin/pi-that-finishes" "$ROOT/bin/pi-that-keeps-working"

start_worker() {
    local label="$1" agent="$2"
    SCRIPT="$ROOT/entrypoint-${label}.sh"

    sed "s#/workspace#${ROOT}/workspace#g" "$ENTRYPOINT" > "$SCRIPT"
    rm -rf "$ROOT/workspace" "$ROOT/home" "$ROOT/committed" "$ROOT/stop"
    rm -f /tmp/pi-in /tmp/pi-done /tmp/pi-rejected /tmp/pi-consumer-done /tmp/pi-stream.jsonl
    mkdir -p "$ROOT/home"
    cp "$ROOT/bin/$agent" "$ROOT/bin/pi"
    git -C "$ROOT/upstream.git" update-ref -d "refs/heads/${BRANCH}" 2>/dev/null

    env -i \
        HOME="$ROOT/home" \
        PATH="$ROOT/bin:/usr/local/bin:/usr/bin:/bin" \
        DIRECT_HARNESS="pi" \
        DIRECT_PROVIDER="openai-codex" \
        DIRECT_PI_OAUTH_CREDENTIAL="$CREDENTIAL" \
        DIRECT_MODEL="gpt-5.3-codex" \
        DIRECT_REPOSITORY_URL="$ROOT/upstream.git" \
        DIRECT_BRANCH="$BRANCH" \
        DIRECT_WORK_ID="spec" \
        DIRECT_PROMPT="do the work" \
        bash "$SCRIPT" > "$ROOT/${label}.log" 2>&1 &
    WORKER=$!

    local waited=0
    while [[ ! -f "$ROOT/committed" && $waited -lt 600 ]]; do sleep 0.1; waited=$((waited + 1)); done
    [[ -f "$ROOT/committed" ]]
}

await_worker() {
    local waited=0
    while kill -0 "$WORKER" 2>/dev/null && [[ $waited -lt 900 ]]; do sleep 0.1; waited=$((waited + 1)); done
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

echo "=== a Pi session on a ChatGPT subscription seeds Pi's credential store, pushes once, exits 0 ==="
if ! start_worker finishing pi-that-finishes; then
    fail_case "the agent never got as far as committing"
else
    if ! await_worker; then
        fail_case "the worker never exited"
        kill -KILL "$WORKER" 2>/dev/null
    elif [[ $WORKER_STATUS -ne 0 ]]; then
        fail_case "the worker exited ${WORKER_STATUS} rather than 0"
    elif [[ ! -f "$ROOT/home/.pi/agent/auth.json" ]]; then
        fail_case "Pi's credential store was never seeded, so the session could not have authenticated"
    elif [[ "$(jq -r '."openai-codex".refresh // empty' "$ROOT/home/.pi/agent/auth.json")" != "rt" ]]; then
        fail_case "the credential landed in the wrong shape: $(cat "$ROOT/home/.pi/agent/auth.json")"
    elif ! pushed; then
        fail_case "${BRANCH} never reached the remote"
    elif [[ $(grep -c "Pushed ${BRANCH}" "$ROOT/finishing.log") -ne 1 ]]; then
        fail_case "pushed $(grep -c "Pushed ${BRANCH}" "$ROOT/finishing.log") times rather than once"
    else
        echo "  RESULT: seeded, pushed once, exited 0 - $(git -C "$ROOT/upstream.git" log --oneline -1 "$BRANCH")"
    fi
fi

echo
echo "=== a stopped Pi container pushes before it goes away ==="
if ! start_worker terminated pi-that-keeps-working; then
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
if [[ $FAILURES -eq 0 ]]; then
    echo "OK"
else
    echo "FAILED (${FAILURES})"
fi
exit "$FAILURES"
