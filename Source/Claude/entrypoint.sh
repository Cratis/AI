#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Entrypoint for the Planner worker container.
#
# The Planner provides work through environment variables:
#   PLANNER_REPOSITORY_URL   - HTTPS clone URL of the repository to work on (issue work)
#   PLANNER_REPOSITORY_URLS  - space-separated clone URLs (ad-hoc work over several repositories)
#   PLANNER_BRANCH           - branch to create for the work
#   PLANNER_WORK_ID          - unique id of the scheduled work item
#   PLANNER_PROMPT           - the instructions for the agent (markdown)
#   PLANNER_MODEL            - the model to use (e.g. opus, sonnet)
#   PLANNER_CALLBACK_URL     - URL the container reports progress/completion to
#   PLANNER_GIT_USER_NAME    - git config user.name for commits made in this container
#   PLANNER_GIT_USER_EMAIL   - git config user.email for commits made in this container
#   GITHUB_TOKEN             - a short-lived GitHub App installation token, used for git and the GitHub CLI
#   CLAUDE_CODE_OAUTH_TOKEN  - credential for the Claude CLI (from the configured Claude account)
#
# The Claude session runs with stream-json input/output: the console output is the live event
# stream the Planner tails, and lines written to the container's stdin are forwarded to the
# session as steering messages while it works.
set -uo pipefail

log() { printf '[planner-worker] %s\n' "$*"; }

STREAM_FILE=/tmp/claude-stream.jsonl
: > "$STREAM_FILE"

report() {
    local status="$1"
    local detail="${2:-}"
    local input_tokens="${3:-0}"
    local output_tokens="${4:-0}"
    local cost="${5:-0}"
    local duration="${6:-0}"
    if [[ -n "${PLANNER_CALLBACK_URL:-}" ]]; then
        jq -cn \
            --arg status "$status" \
            --arg detail "$detail" \
            --argjson inputTokens "$input_tokens" \
            --argjson outputTokens "$output_tokens" \
            --argjson costUsd "$cost" \
            --argjson durationMs "$duration" \
            '{status: $status, detail: $detail, inputTokens: $inputTokens, outputTokens: $outputTokens, costUsd: $costUsd, durationMs: $durationMs}' |
        curl -fsS -X POST "${PLANNER_CALLBACK_URL}" -H 'Content-Type: application/json' -d @- \
            || log "Failed to report status '${status}' to ${PLANNER_CALLBACK_URL}"
    fi
}

wrap_user_message() {
    jq -cn --arg text "$1" '{type: "user", message: {role: "user", content: [{type: "text", text: $text}]}}'
}

fail() {
    report failed "$1"
    exit 1
}

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    git config --global credential.helper '!f() { echo "username=x-access-token"; echo "password=${GITHUB_TOKEN}"; }; f'
fi
if [[ -n "${PLANNER_GIT_USER_NAME:-}" ]]; then
    git config --global user.name "${PLANNER_GIT_USER_NAME}"
fi
if [[ -n "${PLANNER_GIT_USER_EMAIL:-}" ]]; then
    git config --global user.email "${PLANNER_GIT_USER_EMAIL}"
fi

# Route the agent's shell commands through rtk - installs the hook that transparently prefixes
# supported commands, minimizing token consumption.
rtk init -g || log "rtk init failed - continuing without token optimization"

# Clone what the work covers: one repository for issue work at the workspace root, or one folder
# per repository for ad-hoc work.
if [[ -n "${PLANNER_REPOSITORY_URLS:-}" ]]; then
    for url in ${PLANNER_REPOSITORY_URLS}; do
        name=$(basename "$url" .git)
        if [[ ! -d "/workspace/$name/.git" ]]; then
            log "Cloning $url"
            git clone "$url" "/workspace/$name" || fail "Could not clone $url"
        fi
        if [[ -n "${PLANNER_BRANCH:-}" ]]; then
            git -C "/workspace/$name" checkout -B "$PLANNER_BRANCH"
        fi
    done
elif [[ -n "${PLANNER_REPOSITORY_URL:-}" ]]; then
    if [[ ! -d /workspace/.git ]]; then
        log "Cloning ${PLANNER_REPOSITORY_URL}"
        git clone "${PLANNER_REPOSITORY_URL}" /workspace || fail "Could not clone ${PLANNER_REPOSITORY_URL}"
    fi
    if [[ -n "${PLANNER_BRANCH:-}" ]]; then
        git -C /workspace checkout -B "$PLANNER_BRANCH"
    fi
fi

cd /workspace

if [[ -z "${PLANNER_PROMPT:-}" ]]; then
    log "No PLANNER_PROMPT provided - nothing to do"
    fail "No prompt provided"
fi

report started "Worker started"
log "Starting Claude CLI (model: ${PLANNER_MODEL:-default})"

MODEL_ARGS=()
if [[ -n "${PLANNER_MODEL:-}" ]]; then
    MODEL_ARGS+=(--model "${PLANNER_MODEL}")
fi

PIPE=/tmp/claude-in
mkfifo "$PIPE"

# Feeder: the initial prompt, then every line arriving on the container's stdin becomes a
# steering message to the running session. Killed when the session produces its result, which
# closes the pipe and lets the CLI exit.
{
    wrap_user_message "$PLANNER_PROMPT"
    while IFS= read -r line; do
        [[ -n "$line" ]] && wrap_user_message "$line"
    done
} > "$PIPE" &
FEEDER_PID=$!

claude -p \
    --input-format stream-json \
    --output-format stream-json \
    --verbose \
    --dangerously-skip-permissions \
    "${MODEL_ARGS[@]}" < "$PIPE" |
while IFS= read -r event; do
    printf '%s\n' "$event"
    printf '%s\n' "$event" >> "$STREAM_FILE"
    if [[ "$(jq -r '.type // empty' <<<"$event" 2>/dev/null)" == "result" ]]; then
        kill "$FEEDER_PID" 2>/dev/null || true
    fi
done
CLAUDE_EXIT=${PIPESTATUS[0]}
kill "$FEEDER_PID" 2>/dev/null || true

RESULT_EVENT=$(jq -c 'select(.type == "result")' "$STREAM_FILE" 2>/dev/null | tail -1)
RESULT=$(jq -r '.result // empty' <<<"$RESULT_EVENT" 2>/dev/null)
INPUT_TOKENS=$(jq -r '(.usage.input_tokens // 0) + (.usage.cache_creation_input_tokens // 0) + (.usage.cache_read_input_tokens // 0)' <<<"$RESULT_EVENT" 2>/dev/null || echo 0)
OUTPUT_TOKENS=$(jq -r '.usage.output_tokens // 0' <<<"$RESULT_EVENT" 2>/dev/null || echo 0)
COST=$(jq -r '.total_cost_usd // 0' <<<"$RESULT_EVENT" 2>/dev/null || echo 0)
DURATION=$(jq -r '.duration_ms // 0' <<<"$RESULT_EVENT" 2>/dev/null || echo 0)

if [[ ${CLAUDE_EXIT} -ne 0 || -z "$RESULT_EVENT" ]]; then
    log "Claude CLI exited with ${CLAUDE_EXIT}"
    report failed "${RESULT:-Claude CLI exited with ${CLAUDE_EXIT}}"
    exit 1
fi

report completed "${RESULT:-Work completed}" "$INPUT_TOKENS" "$OUTPUT_TOKENS" "$COST" "$DURATION"
log "Done"
