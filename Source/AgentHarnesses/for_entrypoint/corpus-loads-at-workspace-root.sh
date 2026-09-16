#!/usr/bin/env bash
# Reproduces Cratis/Stagehand#603 - a workspace whose repository (or repositories) carry a
# .claude/.ai corpus should always end up with that corpus reachable directly under /workspace,
# because Claude Code only reads project instructions from its working directory and that
# directory's *ancestors*, never a descendant. Before the fix, DIRECT_REPOSITORY_URLS with even
# a single entry nested the checkout under /workspace/<name>, leaving /workspace itself with no
# corpus at all - identical to what ad-hoc work, task runs and merge-conflict resolution all send.
#
# Runs the real entrypoint.sh, not a reimplementation of it - same approach as
# terminated-worker-pushes-commits.sh. Only the hardcoded /workspace path is substituted, and stub
# `claude`/`rtk` binaries sit on PATH so the harness never tries to run a real agent. The script
# runs under `env -i` so it sees only the variables named here.
#
# Exits non-zero when any of the three cases below does not match what the fix promises.
#
# seed_repo()'s commit disables maintenance.auto/gc.auto - it shells out to a separate, backgrounded
# `git maintenance run --auto --detach` by default (verified against git's own source), which #701
# root-caused for the mirror-compaction spec and which caused a runner-only flake in
# terminated-worker-pushes-commits.sh. Nothing in a throwaway, single-use repo benefits from
# opportunistic background housekeeping.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
ROOT="${HERE}/corpustest"
chmod -R u+w "$ROOT" 2>/dev/null; rm -rf "$ROOT"; mkdir -p "$ROOT"

BRANCH="direct/spec-corpus"
FAILURES=0

# Seeds a bare "upstream" repo whose checkout carries a .claude/CLAUDE.md marker, symlinked from
# .ai/rules/general.md the way every real Cratis repository in this corpus does.
seed_repo() {
    local name="$1" marker="$2"
    git init -q -b main "$ROOT/seed-${name}"
    git -C "$ROOT/seed-${name}" config user.email a@b.c; git -C "$ROOT/seed-${name}" config user.name t
    mkdir -p "$ROOT/seed-${name}/.claude" "$ROOT/seed-${name}/.ai/rules"
    echo "$marker" > "$ROOT/seed-${name}/.ai/rules/general.md"
    ln -s ../.ai/rules/general.md "$ROOT/seed-${name}/.claude/CLAUDE.md"
    echo "unrelated file" > "$ROOT/seed-${name}/file.cs"
    git -C "$ROOT/seed-${name}" add .; git -c maintenance.auto=false -c gc.auto=0 -C "$ROOT/seed-${name}" commit -qm init
    git init -q --bare -b main "$ROOT/upstream-${name}.git"
    git -C "$ROOT/seed-${name}" push -q "$ROOT/upstream-${name}.git" HEAD:refs/heads/main
}

seed_repo one "marker: repo one"
seed_repo two "marker: repo two"

mkdir -p "$ROOT/bin"
printf '#!/bin/sh\nexit 0\n' > "$ROOT/bin/rtk"
# Stands in for the agent CLI: emits the one stream-json event the harness reads its result out
# of, and exits 0. This spec is about where the checkout lands, not what the agent does with it.
cat > "$ROOT/bin/claude" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' '{"type":"result","result":"all done","usage":{"input_tokens":1,"output_tokens":2},"total_cost_usd":0.5,"duration_ms":10}'
STUB
chmod +x "$ROOT/bin/rtk" "$ROOT/bin/claude"

fail_case() {
    echo "  RESULT: $1 - see $ROOT"
    FAILURES=$((FAILURES + 1))
}

# Runs the real entrypoint with the given env, path-substituted so /workspace lands under $ROOT.
run_worker() {
    local label="$1"; shift
    SCRIPT="$ROOT/entrypoint-${label}.sh"
    sed "s#/workspace#${ROOT}/workspace#g" "$ENTRYPOINT" > "$SCRIPT"
    rm -rf "$ROOT/workspace" "$ROOT/home"
    rm -f /tmp/claude-in /tmp/claude-exit /tmp/claude-stream.jsonl
    mkdir -p "$ROOT/home"

    env -i \
        HOME="$ROOT/home" \
        PATH="$ROOT/bin:/usr/local/bin:/usr/bin:/bin" \
        DIRECT_BRANCH="$BRANCH" \
        DIRECT_WORK_ID="spec" \
        DIRECT_PROMPT="do the work" \
        "$@" \
        bash "$SCRIPT" > "$ROOT/${label}.log" 2>&1
}

echo "=== control: DIRECT_REPOSITORY_URL (singular) clones straight into /workspace ==="
run_worker singular env DIRECT_REPOSITORY_URL="$ROOT/upstream-one.git"
if [[ "$(cat "$ROOT/workspace/.claude/CLAUDE.md" 2>/dev/null)" != "marker: repo one" ]]; then
    fail_case "marker not found directly at /workspace/.claude/CLAUDE.md"
else
    echo "  RESULT: marker resolved directly at workspace root"
fi

echo
echo "=== regression: DIRECT_REPOSITORY_URLS with exactly one entry behaves the same ==="
run_worker single-plural env DIRECT_REPOSITORY_URLS="$ROOT/upstream-one.git"
if [[ -e "$ROOT/workspace/upstream-one" ]]; then
    fail_case "checkout nested under /workspace/upstream-one instead of landing at /workspace"
elif [[ "$(cat "$ROOT/workspace/.claude/CLAUDE.md" 2>/dev/null)" != "marker: repo one" ]]; then
    fail_case "marker not found directly at /workspace/.claude/CLAUDE.md"
else
    echo "  RESULT: single-entry DIRECT_REPOSITORY_URLS normalized to the workspace root"
fi

echo
echo "=== multi-repository: each repo keeps its own folder, first-listed corpus symlinked to root ==="
run_worker multi env DIRECT_REPOSITORY_URLS="$ROOT/upstream-one.git $ROOT/upstream-two.git"
if [[ "$(cat "$ROOT/workspace/upstream-one/.claude/CLAUDE.md" 2>/dev/null)" != "marker: repo one" ]]; then
    fail_case "repo one's own marker missing at /workspace/upstream-one/.claude/CLAUDE.md"
elif [[ "$(cat "$ROOT/workspace/upstream-two/.claude/CLAUDE.md" 2>/dev/null)" != "marker: repo two" ]]; then
    fail_case "repo two's own marker missing at /workspace/upstream-two/.claude/CLAUDE.md"
elif [[ ! -L "$ROOT/workspace/.claude" ]]; then
    fail_case "/workspace/.claude is not a symlink"
elif [[ "$(cat "$ROOT/workspace/.claude/CLAUDE.md" 2>/dev/null)" != "marker: repo one" ]]; then
    fail_case "/workspace/.claude does not resolve to the first-listed repository's corpus"
elif [[ ! -L "$ROOT/workspace/.ai" ]]; then
    fail_case "/workspace/.ai is not a symlink"
else
    echo "  RESULT: /workspace/.claude and /workspace/.ai resolve to repo one, each repo keeps its own"
fi

echo
if [[ $FAILURES -eq 0 ]]; then
    echo "OK"
else
    echo "FAILED (${FAILURES})"
fi
exit "$FAILURES"
