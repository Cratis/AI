#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Entrypoint for the Planner worker container.
#
# The Planner provides work through environment variables:
#   PLANNER_REPOSITORY_URL   - HTTPS clone URL of the repository to work on (optional when code is mounted)
#   PLANNER_BRANCH           - branch to create for the work (default: derived from the work id)
#   PLANNER_WORK_ID          - unique id of the scheduled work item ({org}-{repo}-{issue})
#   PLANNER_PROMPT           - the instructions for the agent (markdown)
#   PLANNER_MODEL            - the model to use (e.g. opus, sonnet)
#   PLANNER_CALLBACK_URL     - URL the container reports progress/completion to
#   GITHUB_TOKEN             - token used for git and the GitHub CLI
#   CLAUDE_CODE_OAUTH_TOKEN  - credential for the Claude CLI (from the configured Claude account)
#
# When /workspace already contains a checkout (mounted), the clone step is skipped.
set -euo pipefail

log() { printf '[planner-worker] %s\n' "$*"; }

report() {
    local status="$1"
    local detail="${2:-}"
    if [[ -n "${PLANNER_CALLBACK_URL:-}" ]]; then
        curl -fsS -X POST "${PLANNER_CALLBACK_URL}" \
            -H 'Content-Type: application/json' \
            -d "{\"workId\":\"${PLANNER_WORK_ID:-unknown}\",\"status\":\"${status}\",\"detail\":$(jq -Rn --arg d "$detail" '$d')}" \
            || log "Failed to report status '${status}' to ${PLANNER_CALLBACK_URL}"
    fi
}

trap 'report failed "Worker terminated unexpectedly"' ERR

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    git config --global credential.helper '!f() { echo "username=x-access-token"; echo "password=${GITHUB_TOKEN}"; }; f'
    git config --global user.name "Cratis Planner"
    git config --global user.email "planner@cratis.io"
fi

if [[ ! -d /workspace/.git && -n "${PLANNER_REPOSITORY_URL:-}" ]]; then
    log "Cloning ${PLANNER_REPOSITORY_URL}"
    git clone "${PLANNER_REPOSITORY_URL}" /workspace
fi

cd /workspace

if [[ -n "${PLANNER_BRANCH:-}" ]]; then
    git checkout -B "${PLANNER_BRANCH}"
fi

if [[ -z "${PLANNER_PROMPT:-}" ]]; then
    log "No PLANNER_PROMPT provided - nothing to do"
    report failed "No prompt provided"
    exit 1
fi

report started "Worker started"
log "Starting Claude CLI (model: ${PLANNER_MODEL:-default})"

MODEL_ARGS=()
if [[ -n "${PLANNER_MODEL:-}" ]]; then
    MODEL_ARGS+=(--model "${PLANNER_MODEL}")
fi

set +e
claude -p "${PLANNER_PROMPT}" \
    --dangerously-skip-permissions \
    --output-format json \
    "${MODEL_ARGS[@]}" \
    > /tmp/claude-result.json
CLAUDE_EXIT=$?
set -e

RESULT=$(jq -r '.result // empty' /tmp/claude-result.json 2>/dev/null || true)

if [[ ${CLAUDE_EXIT} -ne 0 ]]; then
    log "Claude CLI exited with ${CLAUDE_EXIT}"
    report failed "${RESULT:-Claude CLI exited with ${CLAUDE_EXIT}}"
    exit "${CLAUDE_EXIT}"
fi

report completed "${RESULT:-Work completed}"
log "Done"
