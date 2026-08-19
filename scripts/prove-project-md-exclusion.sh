#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Proves, in both directions, whether a project-local .agents/PROJECT.md can be broadcast from
# one Cratis repository into every other one.
#
# Why this exists here, when the code it tests lives in Cratis/Workflows: the failure it guards
# is real and already happened. On 2026-07-30 Cratis/Chronicle broadcast its PROJECT.md into
# Automation, Narrator, Prompter, Specifications and VerticalSlices, where a file titled
# "Chronicle - Project-Specific Instructions" is still served today as those repositories' own
# project-local instructions. AGENTS.md gives that file authority OVER the shared corpus, so a
# foreign copy does not add noise, it overrides the corpus with another repository's rules.
#
# The selector that allows this is in Cratis/Workflows, which this repository must not modify.
# So the harness lives here and is run against a checkout of that repository, and the fix is
# applied there with this output in the commit body. See the EXECUTION BRIEF in PLAN.md (E1).
#
# Usage:
#   scripts/prove-project-md-exclusion.sh [path-to-Workflows-checkout]
#
# Exit codes:
#   0  the guard behaves as intended (PROJECT.md is excluded even with no .copilot-sync-ignore)
#   1  the guard is absent or incomplete: a source with no ignore file broadcasts PROJECT.md
#   2  the harness could not run (missing checkout, missing script, missing dependency)

set -uo pipefail

# Default to a Workflows checkout beside the real repository. Resolved from the git common
# directory rather than from this script's path, so it is still correct when this repository is
# checked out as a worktree somewhere else entirely (which is how session 3 had to work).
if [ -n "${1:-}" ]; then
    WORKFLOWS_ROOT="$1"
else
    repository_root=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
    if [ -n "$repository_root" ]; then
        WORKFLOWS_ROOT="$(cd "$(dirname "$repository_root")/.." && pwd)/Workflows"
    else
        WORKFLOWS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/Workflows"
    fi
fi
FILTER="${WORKFLOWS_ROOT}/.github/scripts/copilot-sync-ignore-filter.sh"
IGNORE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.github/.copilot-sync-ignore"

if [ ! -f "$FILTER" ]; then
    echo "FAIL: cannot find the sync-ignore filter at ${FILTER}" >&2
    echo "      pass the path to a Cratis/Workflows checkout as the first argument" >&2
    exit 2
fi
if [ ! -f "${WORKFLOWS_ROOT}/.github/scripts/prepare-copilot-source-artifact.sh" ]; then
    echo "FAIL: cannot find prepare-copilot-source-artifact.sh under ${WORKFLOWS_ROOT}" >&2
    exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
    echo "FAIL: jq is required" >&2
    exit 2
fi

# The selector is EXTRACTED FROM the real prepare-copilot-source-artifact.sh rather than copied
# into this file. An earlier version of this script inlined its own transcription of the jq
# filter, which made it test the transcription instead of the shipped code: it went on reporting
# NOT GUARDED after the upstream fix had already landed, because the copy here still lacked the
# exclusion. A harness that can pass or fail independently of the code it audits is worse than no
# harness, so the filter text is now read from the artifact script at run time.
ARTIFACT_SCRIPT="${WORKFLOWS_ROOT}/.github/scripts/prepare-copilot-source-artifact.sh"

select_copilot_files() {
    if [ -z "${SELECTOR_JQ:-}" ]; then
        echo "FAIL: could not extract the selector from ${ARTIFACT_SCRIPT}" >&2
        exit 2
    fi
    jq -c "$SELECTOR_JQ"
}

# Pull the jq program out of the `copilot_files=$(echo "$source_tree_raw" | jq -c '...')`
# assignment: everything between the first single quote after `jq -c` and the closing quote.
extract_selector() {
    python3 - "$ARTIFACT_SCRIPT" <<'PYTHON'
import re
import sys

source = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r"copilot_files=\$\(echo \"\$source_tree_raw\" \| jq -c \\\n\s*'(.*?)'", source, re.S)
if not match:
    sys.exit(1)
sys.stdout.write(match.group(1))
PYTHON
}

# Runs one case through the real filter and prints whether PROJECT.md survived.
# $1 = human label, $2 = contents of the source repository's .copilot-sync-ignore ("" for none)
run_case() {
    local label="$1" ignore_content="$2"

    # These three are the filter's documented inputs: it reads them from the calling scope and
    # rewrites copilot_files in place. shellcheck cannot see that across the `source` below.
    # shellcheck disable=SC2034
    source_tree_raw=$(jq -nc '{tree:[
        {path:".agents/PROJECT.md",        type:"blob", sha:"aaa", mode:"100644"},
        {path:".agents/skills/x/SKILL.md", type:"blob", sha:"bbb", mode:"100644"},
        {path:".ai/rules/csharp.md",       type:"blob", sha:"ccc", mode:"100644"},
        {path:"AGENTS.md",                 type:"blob", sha:"ddd", mode:"100644"}]}')
    # shellcheck disable=SC2034
    source_repo="Cratis/Fake"
    copilot_files=$(printf '%s' "$source_tree_raw" | select_copilot_files)

    if [ -n "$ignore_content" ]; then
        source_tree_raw=$(printf '%s' "$source_tree_raw" |
            jq -c '.tree += [{path:".github/.copilot-sync-ignore",type:"blob",sha:"eee",mode:"100644"}]')
        # The filter fetches the ignore blob through this helper; stub it so no network is needed
        # and the content under test is exactly what we passed in. Invoked indirectly, by the
        # sourced filter rather than from this file.
        # shellcheck disable=SC2329
        gh_api_with_retry() { printf '%s' "$ignore_content" | base64; }
    else
        # shellcheck disable=SC2329
        gh_api_with_retry() { printf ''; }
    fi

    # shellcheck source=/dev/null
    source "$FILTER"
    _apply_copilot_sync_ignore >/dev/null 2>&1

    local kept project_present
    kept=$(printf '%s' "$copilot_files" | jq -c '[.[].path]')
    project_present=$(printf '%s' "$copilot_files" | jq -r '[.[].path] | index(".agents/PROJECT.md") != null')

    echo "  ${label}"
    echo "    PROJECT.md propagated : ${project_present}"
    echo "    files kept            : ${kept}"

    CASE_PROJECT_PRESENT="$project_present"
    CASE_KEPT="$kept"
}

SELECTOR_JQ="$(extract_selector)" || {
    echo "FAIL: could not extract the selector from ${ARTIFACT_SCRIPT}" >&2
    echo "      its shape changed; update extract_selector rather than re-inlining a copy" >&2
    exit 2
}

echo "Proving the PROJECT.md exclusion against ${WORKFLOWS_ROOT}"
echo "  selector read live from prepare-copilot-source-artifact.sh"
echo "  ignore filter: ${FILTER}"
echo

echo "CASE 1 - a source repository with NO .copilot-sync-ignore of its own."
echo "         Nine repositories in the fleet are in exactly this state."
run_case "no ignore file:" ""
unguarded_present="$CASE_PROJECT_PRESENT"
echo

echo "CASE 2 - a source repository carrying this repository's .copilot-sync-ignore."
if [ -f "$IGNORE_FILE" ]; then
    run_case "with an ignore file:" "$(cat "$IGNORE_FILE")"
    guarded_kept="$CASE_KEPT"
else
    echo "  SKIPPED: ${IGNORE_FILE} not found"
    guarded_kept=""
fi
echo

# The corpus itself must still propagate; an exclusion that swallows the corpus is worse than
# the bug it fixes, and would not be caught by only asserting that PROJECT.md is gone.
if [ -n "$guarded_kept" ] && ! printf '%s' "$guarded_kept" | jq -e 'index(".ai/rules/csharp.md") != null' >/dev/null; then
    echo "FAIL: the ignore file also excluded the shared corpus - that is not the intent." >&2
    exit 1
fi

if [ "$unguarded_present" = "true" ]; then
    cat <<'MESSAGE'
RESULT: NOT GUARDED.

A source repository with no .copilot-sync-ignore of its own still broadcasts its
.agents/PROJECT.md to every other repository. The per-source ignore file is the only
defense, and repositories without one are exposed.

Fix: exclude .agents/PROJECT.md in the selector in
Cratis/Workflows/.github/scripts/prepare-copilot-source-artifact.sh, alongside the existing
.claude/settings.local.json exclusion, then re-run this harness and expect RESULT: GUARDED.

If you believe the fix is already applied, check that the checkout being tested is current:
this harness reads the selector from that checkout, so a stale clone reports a stale answer.
MESSAGE
    exit 1
fi

echo "RESULT: GUARDED. A source with no ignore file no longer broadcasts .agents/PROJECT.md,"
echo "        and the shared corpus still propagates."
exit 0
