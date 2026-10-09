#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# Exercises the real entrypoint with a local bundle and hermetic CLI/HTTP doubles. Temporary
# container paths and GNU time are relocated so this fixture also runs on a non-Linux workstation.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/scratch.sh
source "$HERE/lib/scratch.sh"
scratch_create bundle-diff
ROOT="$SCRATCH_ROOT"
mkdir -p "$ROOT/bin" "$ROOT/tmp"
mkfifo "$ROOT/hold"
git init -qb main "$ROOT/seed"
git -C "$ROOT/seed" config user.name fixture
git -C "$ROOT/seed" config user.email fixture@localhost
printf 'baseline\n' > "$ROOT/seed/committed.txt"
printf 'baseline\n' > "$ROOT/seed/edited.txt"
git -C "$ROOT/seed" add -A
git -c maintenance.auto=false -c gc.auto=0 -C "$ROOT/seed" commit -qm baseline
BASE=$(git -C "$ROOT/seed" rev-parse HEAD)
git -C "$ROOT/seed" bundle create "$ROOT/baseline.bundle" --all
jq -cn --arg base "$BASE" '{baseCommit: $base}' > "$ROOT/request.json"
# Only container-specific paths are changed; no shipped behavior is stripped out.
sed -e "s#/workspace#$ROOT/workspace#g" -e "s#/tmp/#$ROOT/tmp/#g" \
    -e "s#/usr/bin/time#$ROOT/bin/time#g" \
    -e "s#/usr/local/share/direct/pi-extension-allow-list.sh#$HERE/../pi-extensions/allow-list.sh#g" \
    "$HERE/../entrypoint.sh" > "$ROOT/entrypoint.sh"
printf '#!/bin/sh\nexit 0\n' > "$ROOT/bin/rtk"
# Keep FIFO writers alive on BSD as well as GNU sleep; no production code is changed.
cat > "$ROOT/bin/sleep" <<'STUB'
#!/usr/bin/env bash
if [[ "$1" == infinity ]]; then
    exec 8<> "$BUNDLE_FIXTURE_ROOT/hold"
    read -r -u 8 unused
else
    exec /bin/sleep "$@"
fi
STUB
cat > "$ROOT/bin/time" <<'STUB'
#!/usr/bin/env bash
while [[ "$1" != -- ]]; do shift; done
shift
exec "$@"
STUB
# BSD date does not implement milliseconds. The elapsed-duration contract still gets real time.
cat > "$ROOT/bin/date" <<'STUB'
#!/usr/bin/env bash
if [[ "$1" == +%s%3N ]]; then printf '%s000\n' "$(/bin/date +%s)"; else exec /bin/date "$@"; fi
STUB
cat > "$ROOT/bin/curl" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
root="$BUNDLE_FIXTURE_ROOT" url= data= dest= auth=
while [[ $# -gt 0 ]]; do
    case "$1" in
        http://fixture/*) url="$1" ;;
        -d|--data-binary) shift; data="$1" ;;
        -o) shift; dest="$1" ;;
        -H) shift; [[ "$1" != Authorization:* ]] || auth="$1" ;;
    esac
    shift
done
[[ "$auth" == 'Authorization: Bearer callback-secret' ]]
case "$url" in
    */bundle) cp "$root/baseline.bundle" "$dest"; printf 'GET\n' >> "$root/http.log" ;;
    *)
        if [[ "$data" == @- ]]; then body=$(cat); else body=$(cat "${data#@}"); fi
        printf '%s\n' "$body" >> "$root/http.jsonl"
        case "$url" in
            */result) printf '%s' "$body" > "$root/result.json"; [[ "$FIXTURE_CASE" != delivery-failure ]] || exit 22 ;;
            */progress) [[ "$FIXTURE_CASE" != progress-failure ]] || exit 22 ;;
        esac ;;
esac
STUB
cat > "$ROOT/bin/agent" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
root="$BUNDLE_FIXTURE_ROOT"
printf '%s\n' "$*" > "$root/agent-args"
[[ -z "$(git remote)" ]]
if [[ "$DIRECT_HARNESS" == claude-code ]]; then
    read -r prompt
    cp "$root/tmp/mcp-config.json" "$root/mcp.json"
fi
if [[ "$FIXTURE_CASE" != empty ]]; then
    printf 'committed change\n' > committed.txt
    git add committed.txt
    git -c maintenance.auto=false -c gc.auto=0 commit -qm 'Agent commit'
    printf 'uncommitted change\n' > edited.txt
    printf 'untracked change\n' > 'new file.txt'
    printf '\000\001\377' > binary.dat
fi
case "$FIXTURE_CASE" in
    large) printf '%140000s' '' > large.txt ;;
    structured) printf '{"outcome":"Completed","summary":"Agent summary","gaps":["gap"],"selfChecks":["advisory"],"touchedFiles":["lie"]}' > "$DIRECT_STRUCTURED_RESULT_FILE" ;;
    refused) printf '{"outcome":"Refused"}' > "$DIRECT_STRUCTURED_RESULT_FILE" ;;
    malformed) printf 'not json' > "$DIRECT_STRUCTURED_RESULT_FILE" ;;
    cancelled)
        printf 'ready\n' > "$root/ready"
        exec 8<> "$root/hold"
        read -r -u 8 unused
        exit 1 ;;
    agent-failure) exit 9 ;;
esac
if [[ "$DIRECT_HARNESS" == pi ]]; then
    while read -r command; do
        case "$(jq -r .type <<< "$command")" in
            prompt) printf '%s\n' '{"type":"message_end","message":{"role":"assistant","stopReason":"stop"}}' '{"type":"agent_settled"}' ;;
            get_last_assistant_text) printf '%s\n' '{"type":"response","id":"direct-final-text","data":{"text":"all done"}}' ;;
            get_session_stats) printf '%s\n' '{"type":"response","id":"direct-final-stats","data":{"tokens":{"input":3,"output":2},"cost":0.5}}' ;;
        esac
    done
elif [[ "$DIRECT_HARNESS" == copilot ]]; then
    printf '%s\n' '{"text":"all done","usage":{"input_tokens":3,"output_tokens":2}}'
else
    printf '%s\n' '{"type":"result","result":"all done","usage":{"input_tokens":3,"output_tokens":2},"total_cost_usd":0.5,"duration_ms":10}'
fi
STUB
chmod +x "$ROOT/bin/"*
for harness in claude pi copilot; do cp "$ROOT/bin/agent" "$ROOT/bin/$harness"; done
PATH_FOR_WORKER="$ROOT/bin:$PATH"
CASES=0
run_worker() {
    local label="$1" harness="${2:-claude-code}"
    shift 2
    rm -rf "$ROOT/workspace" "$ROOT/home" "$ROOT/tmp"
    rm -f "$ROOT/result.json" "$ROOT/http.jsonl" "$ROOT/http.log" "$ROOT/agent-args" "$ROOT/mcp.json"
    mkdir -p "$ROOT/home" "$ROOT/tmp"
    : > "$ROOT/http.jsonl"
    env -i HOME="$ROOT/home" PATH="$PATH_FOR_WORKER" TMPDIR="$ROOT/tmp" BUNDLE_FIXTURE_ROOT="$ROOT" \
        FIXTURE_CASE="$label" DIRECT_RUN_MODE=bundle-diff DIRECT_HARNESS="$harness" \
        DIRECT_BUNDLE_URL=http://fixture/bundle DIRECT_RESULT_URL=http://fixture/result \
        DIRECT_REQUEST_FILE="$ROOT/request.json" DIRECT_PROMPT='do the work' DIRECT_MODEL=fixture \
        DIRECT_PROGRESS_URL=http://fixture/progress DIRECT_CALLBACK_URL=http://fixture/callback \
        DIRECT_CALLBACK_TOKEN=callback-secret DIRECT_CORRELATION='{"session":"spec","nested":{"feature":7}}' \
        DIRECT_WORK_ID=run-1 "$@" bash "$ROOT/entrypoint.sh" > "$ROOT/$label.log" 2>&1 &
    WORKER=$!
    scratch_track_pid "$WORKER"
}
await_worker() {
    STATUS=0
    wait "$WORKER" || STATUS=$?
    scratch_untrack_pid "$WORKER"
    CASES=$((CASES + 1))
}
check_diff() {
    jq -e '.structured.outcome == "Completed" and (.structured.touchedFiles | sort) == ["binary.dat","committed.txt","edited.txt","new file.txt"] and .correlation.nested.feature == 7 and .usage.inputTokens == 3' "$ROOT/result.json" >/dev/null
    jq -j .diff "$ROOT/result.json" > "$ROOT/received.diff"
    hash=$(shasum -a 256 "$ROOT/received.diff"); hash="${hash%% *}"
    [[ "$(jq -r .sha256 "$ROOT/result.json")" == "$hash" ]]
    git -C "$ROOT/seed" apply --check "$ROOT/received.diff"
    jq -se '[.[] | select(.kind == "phase") | .phase] == ["started","cloned","agentRunning","diffReady"] and [.[] | select(.kind == "phase") | .sequence] == [1,2,3,4] and all(.[] | select(.kind == "phase"); .schemaVersion == 1 and .runId == "run-1" and .correlation.session == "spec") and (map(.structured.outcome // .phase // .status)) == ["started","cloned","started","agentRunning","Completed","diffReady","completed"]' "$ROOT/http.jsonl" >/dev/null
}
run_worker structured claude-code DIRECT_CONTEXT_MCP_URL=http://fixture/context DIRECT_CONTEXT_MCP_TOKEN=context-secret
await_worker
[[ $STATUS == 0 ]]
check_diff
jq -e '.structured.summary == "Agent summary" and .structured.gaps == ["gap"] and .structured.selfChecks == ["advisory"]' "$ROOT/result.json" >/dev/null
jq -e '.mcpServers.context == {type:"http",url:"http://fixture/context",headers:{Authorization:"Bearer context-secret"}}' "$ROOT/mcp.json" >/dev/null
for harness in pi copilot; do
    run_worker "$harness" "$harness"
    await_worker
    [[ $STATUS == 0 ]]
    check_diff
    [[ "$(jq -r .usage.harness "$ROOT/result.json")" == "$harness" ]]
    [[ "$(cat "$ROOT/agent-args")" != *mcp* ]]
done
for label in empty refused malformed; do
    run_worker "$label" claude-code
    await_worker
    [[ $STATUS == 0 ]]
    case "$label" in
        empty) jq -e '.diff == "" and .structured.outcome == "NoChanges" and .structured.touchedFiles == []' "$ROOT/result.json" >/dev/null ;;
        refused) jq -e '.structured.outcome == "Refused"' "$ROOT/result.json" >/dev/null ;;
        malformed) jq -e '.structured.summary == "all done" and .structured.selfChecks == []' "$ROOT/result.json" >/dev/null ;;
    esac
done
for label in large progress-failure invalid-correlation; do
    extras=()
    [[ "$label" != invalid-correlation ]] || extras=(DIRECT_CORRELATION=invalid)
    run_worker "$label" claude-code "${extras[@]}"
    await_worker
    [[ $STATUS == 0 ]]
    case "$label" in
        large) jq -e '(.diff | length) > 140000 and (.structured.touchedFiles | index("large.txt")) != null' "$ROOT/result.json" >/dev/null ;;
        progress-failure) check_diff ;;
        invalid-correlation) jq -e '.correlation == {}' "$ROOT/result.json" >/dev/null ;;
    esac
done
for invalid in missing absent; do
    if [[ "$invalid" == missing ]]; then printf '{}' > "$ROOT/request.json"; else jq -cn '{baseCommit: "0000000000000000000000000000000000000000"}' > "$ROOT/request.json"; fi
    run_worker invalid-base claude-code
    await_worker
    [[ $STATUS == 1 && ! -f "$ROOT/agent-args" && ! -f "$ROOT/result.json" ]]
    jq -se 'any(.[]; .status == "failed")' "$ROOT/http.jsonl" >/dev/null
done
jq -cn --arg base "$BASE" '{baseCommit: $base}' > "$ROOT/request.json"
for credential in GITHUB_TOKEN GH_TOKEN DIRECT_PUSH_TOKEN_URL DIRECT_CLONE_CREDENTIALS DIRECT_REPOSITORY_URL DIRECT_REPOSITORY_URLS DIRECT_REPOSITORY_CHECKOUTS DIRECT_BRANCH; do
    run_worker credential claude-code "$credential="
    await_worker
    [[ $STATUS == 1 && ! -d "$ROOT/workspace" && ! -f "$ROOT/http.log" ]]
    jq -se 'any(.[]; .status == "failed" and (.detail | startswith("Bundle-diff mode refuses")))' "$ROOT/http.jsonl" >/dev/null
done
for label in delivery-failure agent-failure; do
    run_worker "$label" claude-code
    await_worker
    [[ $STATUS == 1 ]]
    jq -se 'any(.[]; .status == "failed") and all(.[]; .status != "completed" and .phase != "diffReady")' "$ROOT/http.jsonl" >/dev/null
    [[ "$label" != agent-failure || ! -f "$ROOT/result.json" ]]
done
mkfifo "$ROOT/ready"
exec 9<> "$ROOT/ready"
run_worker cancelled claude-code
read -r -t 20 -u 9 ready
kill -TERM "$WORKER"
await_worker
[[ $STATUS == 143 ]]
jq -e '.structured.outcome == "Cancelled" and (.structured.touchedFiles | length) == 4 and (.diff | length) > 0' "$ROOT/result.json" >/dev/null
exec 9>&-
printf 'Passed %s bundle-diff cases\n' "$CASES"
