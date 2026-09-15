#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Entrypoint for the Direct worker container.
#
# The Direct provides work through environment variables:
#   DIRECT_REPOSITORY_URL   - HTTPS clone URL of the repository to work on (issue work)
#   DIRECT_REPOSITORY_URLS  - space-separated clone URLs (ad-hoc work, task runs, merge-conflict
#                               resolution). Carries this even when there is only one repository -
#                               that single-entry case is normalized to clone straight into
#                               /workspace, same as DIRECT_REPOSITORY_URL below, rather than
#                               nesting it under /workspace/<name> where Claude Code's corpus
#                               discovery (working directory + ancestors only) would never find its
#                               .claude/.ai (Cratis/Stagehand#603). With genuinely more than one URL,
#                               each repository still gets its own /workspace/<name> folder, and the
#                               first-listed repository's .claude/.ai are additionally symlinked up
#                               to the workspace root so the agent's starting directory has *a*
#                               corpus - see link_primary_corpus() below.
#   DIRECT_REPOSITORY_CACHE - path to a shared, persistent cache of bare repository mirrors, one
#                               per tracked repository at <cache>/<owner>/<name>.git, kept current by
#                               the Direct's own backend from GitHub push webhooks. Mounted
#                               read-only here: the backend is its only writer, and it runs `git`
#                               inside those mirrors with far more privilege than this container has.
#                               When set and a repository already has an entry there, this container
#                               takes its checkout from it with `git clone --shared`, borrowing its
#                               objects rather than fetching them over the network, and then brings
#                               that checkout current from the remote. Absent entirely
#                               (local/Docker dev), or a repository with no entry yet (first-ever
#                               use), falls back to an ordinary `git clone` - unconditionally, so that
#                               fallback path is what every non-Kubernetes/local run still takes.
#   DIRECT_BRANCH           - branch to create for the work
#   DIRECT_WORK_ID          - unique id of the scheduled work item
#   DIRECT_PROMPT_FILE      - path to a file holding the instructions for the agent (markdown).
#                               The prompt travels as a file rather than a variable because a single
#                               environment variable over MAX_ARG_STRLEN (128 KiB) makes the kernel
#                               refuse the whole execve - the container never starts and the only
#                               trace is "exec ...entrypoint.sh: argument list too long", from the
#                               runtime, before this script has run. A consolidation over seventeen
#                               issues produced 173 KiB. Delivered on the same volume as the
#                               credentials; see WorkerPromptFile on the dispatch side.
#   DIRECT_PROMPT           - the same instructions inline. Superseded by DIRECT_PROMPT_FILE and
#                               read only when no file was delivered, so a container started by an
#                               older runtime still works.
#   DIRECT_MODEL            - the model to use (e.g. opus, sonnet)
#   DIRECT_HARNESS          - which CLI drives the session: unset (the default) or "claude-code"
#                               runs the Claude Code CLI exactly as before; "pi" runs the Pi coding
#                               agent CLI (@earendil-works/pi-coding-agent) instead, over its
#                               `--mode rpc` protocol - see run_pi() below.
#   DIRECT_PROVIDER         - the Pi provider id to pass as `--provider` when DIRECT_HARNESS is
#                               "pi" - always one the Direct's own configured allow-list approved,
#                               never an arbitrary caller-chosen value. Unused by the Claude Code path.
#                               Five values, one per Direct.AIProviders.AIProviderType, all verified
#                               against the real, installed 0.84.3 CLI (`pi --help`, its own bundled
#                               docs, and its @earendil-works/pi-ai dependency's source):
#                                 anthropic                  - Pi's built-in Anthropic provider
#                                 openai                      - Pi's built-in OpenAI provider, used
#                                                               when the credential is an API key
#                                 openai-codex                - Pi's built-in ChatGPT-subscription
#                                                               provider, used when the credential is
#                                                               an OAuth record instead. Pi declares it
#                                                               itself (pi-ai's providers/openai-codex:
#                                                               baseUrl https://chatgpt.com/backend-api,
#                                                               oauth marked isSubscription) - no Pi
#                                                               extension is involved. configure_pi_provider()
#                                                               seeds ~/.pi/agent/auth.json for it; Pi
#                                                               refreshes the credential itself from
#                                                               there.
#                                 azure-openai-responses      - Pi's built-in Azure OpenAI provider,
#                                                               entirely env-var driven (see
#                                                               AZURE_OPENAI_API_KEY/
#                                                               DIRECT_PROVIDER_ENDPOINT below) -
#                                                               an explicit --provider bypasses Pi's
#                                                               own model-catalog check, so the Azure
#                                                               deployment name Direct already
#                                                               treats as the model (see
#                                                               Source/Direct/AIProviders/AzureOpenAI)
#                                                               travels as DIRECT_MODEL/`--model`
#                                                               unchanged - no translation needed.
#                                 direct-openai-compatible - not a Pi vendor id at all: the key
#                                                               configure_pi_provider() (below) declares
#                                                               a self-hosted OpenAI-compatible gateway
#                                                               under, in a generated
#                                                               ~/.pi/agent/models.json, since Pi has no
#                                                               built-in provider or environment
#                                                               variable for an arbitrary custom
#                                                               endpoint (OPENAI_BASE_URL/
#                                                               OPENAI_API_BASE are not read anywhere in
#                                                               pi-ai). Must match
#                                                               HarnessCompatibility.PiProviderIdFor
#                                                               exactly, or the container is handed a
#                                                               provider id nothing declares.
#                                 zai                          - Pi's built-in Z.ai provider, used for a
#                                                               Z.ai (GLM) provider on the Pi harness
#                                                               over its native ZAI_API_KEY (see the
#                                                               credential list below). Pi declares it
#                                                               itself, fixed to Z.ai's public endpoint -
#                                                               there is no env var to point it
#                                                               elsewhere, so the Claude-harness path is
#                                                               the only one that honors a configured
#                                                               Z.ai endpoint (via ANTHROPIC_BASE_URL,
#                                                               set by the Direct's worker
#                                                               environment, never by this script).
#   DIRECT_PROVIDER_ENDPOINT - the base URL/endpoint a configured Azure OpenAI or OpenAI-compatible
#                               provider is reached at (Direct's AIProviderEndpoint) - absent for
#                               anthropic/openai/zai, which use their fixed public API endpoints.
#                               configure_pi_provider() turns it into AZURE_OPENAI_BASE_URL for Azure,
#                               or the `baseUrl` of the generated models.json entry otherwise.
#   DIRECT_CALLBACK_URL     - URL the container reports start/completion/failure to
#   DIRECT_PROGRESS_URL     - URL the report_progress MCP tool posts live plan/status updates to
#                               (Source/AgentHarnesses/progress-mcp-server.mjs) - a sibling of
#                               DIRECT_CALLBACK_URL rather than derived from it by string surgery,
#                               the same one-env-var-per-capability treatment every other endpoint the
#                               container is handed already gets. Wired into the Claude Code path only -
#                               Pi 0.84.x has no MCP client of any kind (verified against the real,
#                               installed CLI: no flag, no settings key, no mention anywhere in its own
#                               bundled code or documentation), so a Pi session has no equivalent way to
#                               post a live plan/checklist. A real gap, not something this script fakes.
#   DIRECT_BUILD_LOG_URL    - set only for ad-hoc work scheduled to investigate a build failure -
#                               URL to fetch that run's already-captured log from. Fetched into
#                               .logs/build.log under the workspace before the agent starts, so it can
#                               read the actual failure output directly instead of having to re-fetch
#                               it itself from GitHub. The fetch is best-effort: the log capture and
#                               the work dispatch are independent, eventually-consistent operations, so
#                               a fetch failure (log not captured yet, transient error) is logged and
#                               otherwise ignored rather than failing the run - the prompt always also
#                               names a fallback command for reading the log directly from GitHub.
#   DIRECT_MEMORY_PATH      - path to the JSONL file the memory MCP server (mcp-server-memory)
#                               persists its knowledge graph to. Set by the Direct to a path under
#                               DIRECT_REPOSITORY_CACHE's own shared volume, scoped by GitHub
#                               organization (.agent-memory/<owner>/memory.jsonl), so project
#                               conventions accumulate across every container that organization ever
#                               spins up - the same way that volume already shares repository mirrors
#                               across containers. run_claude_code() creates the parent directory
#                               before first use, since the MCP server does not create it itself. Left
#                               unset when no repository cache is configured or no owner could be
#                               resolved for the work, in which case run_claude_code() falls back to a
#                               container-local path - the tool still works within one session, it
#                               just starts empty every time. Claude Code path only, for the same
#                               reason as DIRECT_PROGRESS_URL above.
#   DIRECT_HEADROOM         - set to "1" to route the session's model requests through Headroom, a
#                               container-local context-compression proxy baked into the base image
#                               (issue #556). start_headroom() below runs it on loopback. Fails open in
#                               every direction - not in the image, will not start, not ready in time -
#                               because a token-optimization layer must never be able to fail a unit of
#                               work.
#                                 Claude Code: points ANTHROPIC_BASE_URL at the proxy, so the CLI is
#                               invoked with exactly the same flags either way and nothing about how
#                               the session is driven, steered, streamed or reported changes.
#                                 Pi (issue #586): Pi's built-in providers do not read
#                               ANTHROPIC_BASE_URL/OPENAI_BASE_URL at all (verified in
#                               @earendil-works/pi-ai's provider source - both anthropic.js and
#                               openai.js hardcode their baseUrl), so configure_pi_provider() below
#                               routes three of Pi's four provider shapes through the proxy instead by
#                               overriding `providers.<id>.baseUrl` in ~/.pi/agent/models.json - the
#                               same mechanism every custom provider there already uses:
#                                 anthropic/direct-openai-compatible/openai/azure-openai-responses -
#                               routed (issue #646 wired azure-openai-responses in after it was left out
#                               of the initial #586 cut). Fails open the same way the Claude path does:
#                               configure_pi_provider() only rewrites a provider's baseUrl when
#                               start_headroom() actually got the proxy up (checked via HEADROOM_PID),
#                               so a missing/dead/slow proxy leaves the provider configured exactly as
#                               it would be with DIRECT_HEADROOM unset.
#                                 azure-openai-responses is a departure from the bare-origin convention
#                               every other provider here uses. Pi's Azure client
#                               (@earendil-works/pi-ai's azure-openai-responses.js) only rewrites a
#                               configured base URL onto the Azure `/openai/v1` path shape when the
#                               hostname itself looks like an Azure host
#                               (*.openai.azure.com/*.cognitiveservices.azure.com/*.ai.azure.com) - a
#                               loopback address does not, so AZURE_OPENAI_BASE_URL carries the path
#                               explicitly (`http://127.0.0.1:<port>/v1`, confirmed against that
#                               source), and Headroom's `--openai-api-url` gets the real Azure
#                               resource's `/openai` path rather than a bare origin, confirmed against
#                               Headroom's own `handle_openai_responses`/`_normalize_api_url` source.
#                               Not settled by reading source on either side, and not verifiable without
#                               a live Azure OpenAI resource: whether that resource accepts Pi's
#                               hardcoded literal `api-version=v1` on that path, and whether Headroom's
#                               response-side SSE reshaping for `/v1/responses` tolerates whatever shape
#                               Azure's Responses API actually streams back. Wired in on the strength of
#                               source verification rather than a live round-trip - if either turns out
#                               not to hold, the fix is resource-side (use a v1-preview-surface
#                               deployment) or upstream in Headroom, not something to guess into this
#                               script.
#
# Credentials do NOT arrive as environment variables - anything on the container specification is
# readable with `kubectl get job -o yaml` or `docker inspect`, and outlives the container. They
# arrive as a file of shell assignments this script sources, named by DIRECT_SECRETS_FILE
# (Kubernetes mounts a Secret; Docker copies the file onto a tmpfs). From that file:
#   DIRECT_CALLBACK_TOKEN   - bearer token the container authenticates its callbacks with
#   GITHUB_TOKEN             - a short-lived GitHub App installation token, used for git and the GitHub CLI
#   ANTHROPIC_API_KEY        - the acting agent's AI provider key when the provider is Anthropic and
#                             the credential is an actual API key (sk-ant-api...) - the vendor-standard
#                             variable both the Claude CLI and Pi read natively, revealed by the
#                             Direct at dispatch from the provider's protected store
#   CLAUDE_CODE_OAUTH_TOKEN  - the same slot, when that Anthropic credential is instead an OAuth token
#                             minted by `claude setup-token` (sk-ant-oat...) against a Claude
#                             subscription. It is a bearer token, not an API key: the Claude Code CLI
#                             reads it from this variable and authenticates with it correctly, whereas
#                             putting it in ANTHROPIC_API_KEY makes the CLI send it as an API key and
#                             Anthropic answers 401 authentication_failed to every one of the session's
#                             ten retries. Exactly one of the two is ever set - the Direct decides
#                             which from the credential's own prefix (HarnessCompatibility.ApiKeyVariableFor)
#                             - and nothing in this script reads either: load_secrets() exports them and
#                             the CLI picks its own up. Never set for the Pi harness, which has no
#                             bearer-token mode for Anthropic and is refused at dispatch instead.
#   ANTHROPIC_AUTH_TOKEN     - the same slot for a Z.ai provider on the Claude harness: Z.ai's
#                             Anthropic-compatible endpoint authenticates gateway-style keys as a
#                             bearer token, which the Claude CLI sends only from this variable -
#                             putting one in ANTHROPIC_API_KEY makes the CLI send it as an
#                             x-api-key header instead. Travels with ANTHROPIC_BASE_URL, which the
#                             Direct sets to the provider's endpoint as an ordinary environment
#                             variable. Pi has no such notion - its zai provider reads ZAI_API_KEY.
#   OPENAI_API_KEY           - the same, for an OpenAI provider whose credential is an actual API key
#                             (Pi harness only) - the vendor-standard variable Pi reads natively
#   DIRECT_PI_OAUTH_CREDENTIAL - the same slot, when that OpenAI credential is instead the OAuth
#                             record a ChatGPT subscription is authenticated by. It is a JSON object
#                             rather than a string, because it carries the refresh token and expiry Pi
#                             needs to keep itself authenticated - Pi refuses a record missing either
#                             as invalid_state (verified against the real, installed 0.84.3 CLI). It
#                             is not an environment variable Pi reads: configure_pi_provider() below
#                             writes it into ~/.pi/agent/auth.json under the provider id, which is
#                             where Pi's own credential store lives. Exactly one of this and
#                             OPENAI_API_KEY is ever set - the Direct decides which from the
#                             credential's own shape (HarnessCompatibility.ApiKeyVariableFor).
#   AZURE_OPENAI_API_KEY     - the same, for an Azure OpenAI provider (Pi harness only) - the
#                             vendor-standard variable Pi's built-in azure-openai-responses provider
#                             reads natively (verified in its @earendil-works/pi-ai dependency's
#                             source and its own docs/providers.md), so this script does nothing with
#                             it beyond letting load_secrets() export it like every other secret
#   DIRECT_PROVIDER_API_KEY - the same, for an OpenAI-compatible gateway (Pi harness only). No
#                             vendor-standard variable exists for this one - it is not a real vendor -
#                             so configure_pi_provider() (below) writes it into the generated
#                             ~/.pi/agent/models.json *by reference*
#                             (`"apiKey": "$DIRECT_PROVIDER_API_KEY"`, interpolated by Pi's own
#                             config loader against its process environment - verified in its
#                             docs/models.md - not as a literal), so the key value itself never
#                             touches disk. Absent entirely for a gateway that accepts unauthenticated
#                             requests, in which case a harmless placeholder is written instead: Pi's
#                             openai-completions client always sends whatever key resolves as an
#                             `Authorization: Bearer` header (verified in pi-ai's source - there is no
#                             "send no header" mode, unlike Direct's own direct HTTP client for this
#                             same provider type), and docs/models.md's own example for an
#                             unauthenticated local gateway uses the identical placeholder pattern.
#   ZAI_API_KEY              - the same, for a Z.ai (GLM) provider on the Pi harness - the
#                             vendor-standard variable Pi's built-in zai provider reads natively,
#                             so this script does nothing with it beyond letting load_secrets()
#                             export it like every other secret. A Z.ai provider on the Claude
#                             harness instead travels as ANTHROPIC_AUTH_TOKEN above - one provider
#                             type, one credential, two slots, decided by the harness at dispatch.
#   EXA_API_KEY              - optional. Exa's hosted web-search MCP endpoint (mcp.exa.ai) works
#                             anonymously, rate-limited, with no key at all - this only lifts that
#                             limit when the Direct has one to hand out. Claude Code path only, sent
#                             as the `x-api-key` header run_claude_code() puts in the generated
#                             --mcp-config rather than read by any CLI natively, since a remote MCP
#                             server is configuration, not a provider credential the harness itself
#                             consumes.
#
# These arrive as ordinary environment variables, because none of them authenticates anything:
#   DIRECT_GIT_USER_NAME    - git config user.name for commits made in this container
#   DIRECT_GIT_USER_EMAIL   - git config user.email for commits made in this container
#
# Alert investigations additionally get whatever operational access the deployment configured
# (Direct:Operations). Only what is set is passed, so an absent variable means the agent genuinely
# cannot reach that system - the prompt says as much:
#   DIRECT_KUBE_NAMESPACE   - namespace made current in that kubeconfig
#   DOCKER_HOST              - the Docker daemon the docker CLI talks to
#   DIRECT_LOKI_URL         - base URL of Loki, queried with curl
#   DIRECT_GRAFANA_URL      - base URL of Grafana
# and, from the secrets file:
#   DIRECT_KUBECONFIG       - kubeconfig YAML, written to ~/.kube/config for kubectl and helm
#   DIRECT_LOKI_USERNAME    - Loki credentials, when it is protected
#   DIRECT_LOKI_PASSWORD
#   DIRECT_GRAFANA_TOKEN    - Grafana API token
#
# The Claude session runs with stream-json input/output: the console output is the live event
# stream the Direct tails, and lines written to the container's stdin are forwarded to the
# session as steering messages while it works.
set -uo pipefail

log() { printf '[agent-harness] %s\n' "$*"; }

# Load the credentials before anything needs them. The Docker runtime copies the file in after the
# container is created, so it can still be arriving; the readiness marker is written last and is
# what proves the file is complete rather than half-extracted.
load_secrets() {
    local file="${DIRECT_SECRETS_FILE:-}"
    [[ -n "$file" ]] || { log "No secrets file configured - running without credentials"; return; }

    local ready="${file%/*}/secrets.ready"
    local waited=0
    while [[ ! -f "$ready" && $waited -lt 30 ]]; do
        sleep 0.1
        waited=$((waited + 1))
    done

    if [[ ! -f "$ready" ]]; then
        log "Secrets file did not arrive at ${file} - running without credentials"
        return
    fi

    set -a
    # shellcheck source=/dev/null
    if ! . "$file"; then
        set +a
        log "Could not read ${file} - running without credentials"
        return
    fi
    set +a

    # The file has been read into the environment of this process and its children; removing it
    # keeps it out of reach of anything the agent later runs that reads the filesystem. This is
    # best-effort - a read-only Secret volume mount rejects the removal, which is fine, since the
    # mount itself (not this script) is what keeps the file out of reach of anything else.
    rm -f "$file" "$ready" 2>/dev/null
    log "Credentials loaded"
}

load_secrets

STREAM_FILE=/tmp/claude-stream.jsonl
: > "$STREAM_FILE"

report() {
    local status="$1"
    local detail="${2:-}"
    local input_tokens="${3:-0}"
    local output_tokens="${4:-0}"
    local cost="${5:-0}"
    local duration="${6:-0}"
    local cpu_seconds="${7:-0}"
    local memory_bytes="${8:-0}"
    if [[ -n "${DIRECT_CALLBACK_URL:-}" ]]; then
        local auth_args=()
        if [[ -n "${DIRECT_CALLBACK_TOKEN:-}" ]]; then
            auth_args=(-H "Authorization: Bearer ${DIRECT_CALLBACK_TOKEN}")
        fi
        # A worker's callback is its only way to leave a durable record of what happened, and it
        # gets exactly one chance at the end of a session that already cost real time and money -
        # a bare curl treats a rollout's brief connectivity gap the same as a permanent outage,
        # discarding the result and leaving the work stuck Running until the 24h stuck-work sweep
        # sees it. --retry-all-errors covers whatever shape that gap takes (connection refused, a
        # timeout, a stray 5xx) with curl's own exponential backoff, capped so this still exits in
        # bounded time when the callback URL is genuinely gone rather than momentarily interrupted.
        jq -cn \
            --arg status "$status" \
            --arg detail "$detail" \
            --argjson inputTokens "$input_tokens" \
            --argjson outputTokens "$output_tokens" \
            --argjson costUsd "$cost" \
            --argjson durationMs "$duration" \
            --argjson cpuSeconds "$cpu_seconds" \
            --argjson memoryBytes "$memory_bytes" \
            '{status: $status, detail: $detail, inputTokens: $inputTokens, outputTokens: $outputTokens, costUsd: $costUsd, durationMs: $durationMs, cpuSeconds: $cpuSeconds, memoryBytes: $memoryBytes}' |
        curl -fsS --retry 6 --retry-max-time 90 --retry-connrefused --retry-all-errors \
            -X POST "${DIRECT_CALLBACK_URL}" -H 'Content-Type: application/json' "${auth_args[@]}" -d @- \
            || log "Failed to report status '${status}' to ${DIRECT_CALLBACK_URL} after retries"
    fi
}

# Fetches a build failure's already-captured log into the workspace, when this unit of work was
# scheduled to investigate one (DIRECT_BUILD_LOG_URL set). Best-effort: the log capture and this
# work's dispatch are independent, eventually-consistent operations (Cratis/Stagehand#206), so a
# fetch failure here is logged and otherwise ignored - the agent's prompt always also names a
# fallback command for reading the log straight from GitHub.
fetch_build_log() {
    [[ -z "${DIRECT_BUILD_LOG_URL:-}" ]] && return 0

    local auth_args=()
    if [[ -n "${DIRECT_CALLBACK_TOKEN:-}" ]]; then
        auth_args=(-H "Authorization: Bearer ${DIRECT_CALLBACK_TOKEN}")
    fi

    mkdir -p /workspace/.logs
    if curl -fsS --retry 6 --retry-max-time 90 --retry-connrefused --retry-all-errors \
        "${DIRECT_BUILD_LOG_URL}" "${auth_args[@]}" -o /workspace/.logs/build.log; then
        log "Captured build log written to .logs/build.log"
    else
        log "Could not fetch the captured build log from ${DIRECT_BUILD_LOG_URL} - continuing without it"
        rm -f /workspace/.logs/build.log
    fi
}

wrap_user_message() {
    jq -cn --arg text "$1" '{type: "user", message: {role: "user", content: [{type: "text", text: $text}]}}'
}

# The same envelope for text that lives in a file. Used for the prompt, which is routinely larger
# than a single argument may be: MAX_ARG_STRLEN is 128 KiB and the kernel refuses the whole execve
# past it, so `wrap_user_message "$(cat prompt)"` would fail exactly where passing the prompt as an
# environment variable already did. jq's --rawfile reads the file itself and never puts it on argv.
wrap_user_message_file() {
    jq -cn --rawfile text "$1" '{type: "user", message: {role: "user", content: [{type: "text", text: $text}]}}'
}

# Pi's RPC commands, for run_pi() below - a flat `{type, message}` shape rather than Claude's nested
# stream-json user-message envelope (wrap_user_message above). `prompt` starts a turn; `steer` queues
# text into one already running - see docs/rpc.md in @earendil-works/pi-coding-agent, verified against
# the real, installed 0.84.3 CLI.
wrap_pi_prompt() {
    jq -cn --arg text "$1" '{type: "prompt", message: $text}'
}

# As wrap_user_message_file, for Pi - see the note there for why the prompt is read from the file
# rather than passed as an argument.
wrap_pi_prompt_file() {
    jq -cn --rawfile text "$1" '{type: "prompt", message: $text}'
}

wrap_pi_steer() {
    jq -cn --arg text "$1" '{type: "steer", message: $text}'
}

# Parses the CPU time GNU `time -v` reported for the wrapped Claude CLI session out of its report
# file (Cratis/Stagehand#638) - "User time (seconds)" plus "System time (seconds)", summed. Prints 0
# when the file is missing or unparseable (time itself failed to run, say), so a report call always
# has a number to send rather than an empty argument.
claude_cpu_seconds_from_time_file() {
    local file="$1"
    [[ -f "$file" ]] || { echo 0; return; }
    awk -F': ' '
        /User time \(seconds\)/ { user = $2 }
        /System time \(seconds\)/ { sys = $2 }
        END { printf "%.3f", (user + 0) + (sys + 0) }
    ' "$file" 2>/dev/null || echo 0
}

# Parses the peak resident set size GNU `time -v` reported for the wrapped Claude CLI session out of
# its report file, converting from kbytes to bytes. Prints 0 when the file is missing or unparseable.
claude_memory_bytes_from_time_file() {
    local file="$1"
    [[ -f "$file" ]] || { echo 0; return; }
    awk -F': ' '/Maximum resident set size \(kbytes\)/ { printf "%d", ($2 + 0) * 1024 }' "$file" 2>/dev/null || echo 0
}

fail() {
    report failed "$1"
    exit 1
}


if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    # The single quotes are the security property, not an oversight: ${GITHUB_TOKEN} must reach
    # ~/.gitconfig *unexpanded* so the shell git spawns resolves it per invocation. Expanding it
    # here would write the installation token into the git config file in plaintext.
    # shellcheck disable=SC2016
    git config --global credential.helper '!f() { echo "username=x-access-token"; echo "password=${GITHUB_TOKEN}"; }; f'
fi
if [[ -n "${DIRECT_GIT_USER_NAME:-}" ]]; then
    git config --global user.name "${DIRECT_GIT_USER_NAME}"
fi
if [[ -n "${DIRECT_GIT_USER_EMAIL:-}" ]]; then
    git config --global user.email "${DIRECT_GIT_USER_EMAIL}"
fi

# Operational access, when the deployment granted any. The kubeconfig arrives as an environment
# variable and has to land on disk where kubectl and helm look for it - written 0600 because it
# carries a cluster credential.
if [[ -n "${DIRECT_KUBECONFIG:-}" ]]; then
    mkdir -p "${HOME}/.kube"
    umask 077
    printf '%s\n' "${DIRECT_KUBECONFIG}" > "${HOME}/.kube/config"
    umask 022
    if [[ -n "${DIRECT_KUBE_NAMESPACE:-}" ]]; then
        kubectl config set-context --current --namespace "${DIRECT_KUBE_NAMESPACE}" >/dev/null 2>&1 \
            || log "Could not set the current namespace to ${DIRECT_KUBE_NAMESPACE}"
    fi
    log "Kubernetes access configured"
fi

if [[ -n "${DOCKER_HOST:-}" ]]; then
    log "Docker access configured (${DOCKER_HOST})"
fi

# Route the agent's shell commands through rtk - installs the hook that transparently prefixes
# supported commands, minimizing token consumption.
rtk init -g || log "rtk init failed - continuing without token optimization"

# The container-local Headroom proxy the session's model requests are routed through when the
# Direct asked for it (DIRECT_HEADROOM, issue #556). rtk trims what the shell hands the agent;
# this trims what the agent hands the model.
#
# A function rather than something started here, because the harness path that uses it starts several
# minutes after this point - a clone, possibly of a large repository, sits in between - and there is
# nothing to gain from having a proxy idling through it.
#
# Every failure path returns non-zero and leaves the caller to carry on without it. That is the same
# contract `rtk init` above has: a token-optimization layer that cannot start is a smaller problem
# than a unit of work that did not run.
#
# Arguments are forwarded verbatim to `headroom proxy`, appended after this function's own flags -
# used by run_pi() to point the proxy's upstream at a non-default endpoint (--openai-api-url) for the
# direct-openai-compatible provider, where the real endpoint is a Direct-configured gateway
# rather than a fixed vendor URL. Every other caller passes none.
HEADROOM_PORT=8787
HEADROOM_PID=""

start_headroom() {
    [[ "${DIRECT_HEADROOM:-}" == "1" ]] || return 1
    command -v headroom >/dev/null 2>&1 || {
        log "DIRECT_HEADROOM is set but headroom is not in this image - continuing without it"
        return 1
    }

    # --mode cache freezes prior turns so the provider's prefix cache still hits; token mode may
    # rewrite them for more compression, and for a Claude Code session that leans as hard on prompt
    # caching as this one does, the lost cache hits would swamp what the compression saved.
    # The semantic cache is off deliberately: answering a "similar" request with a previous response
    # is a correctness hazard in a coding agent, and inside a single-session throwaway container it
    # could only ever serve itself anyway. Rate limiting is off because pacing already happens in the
    # Direct (Direct:Scheduling) and at the provider - a third limiter can only add stalls
    # nothing explains.
    headroom proxy --host 127.0.0.1 --port "$HEADROOM_PORT" \
        --mode cache --no-cache --no-rate-limit \
        --log-file /tmp/headroom.jsonl "$@" > /tmp/headroom.log 2>&1 &
    HEADROOM_PID=$!

    # /readyz answers 503 until every enabled subsystem is actually up, so it is polled rather than
    # slept against. The `kill -0` is what keeps a proxy that died on startup from costing the full
    # wait before the run gives up on it.
    local waited=0
    until curl -fsS -m 2 "http://127.0.0.1:${HEADROOM_PORT}/readyz" >/dev/null 2>&1; do
        if ! kill -0 "$HEADROOM_PID" 2>/dev/null || [[ $waited -ge 120 ]]; then
            log "Headroom proxy did not become ready - continuing without it"
            sed 's/^/[headroom] /' /tmp/headroom.log 2>/dev/null | tail -20
            kill "$HEADROOM_PID" 2>/dev/null || true
            HEADROOM_PID=""
            return 1
        fi
        sleep 0.5
        waited=$((waited + 1))
    done

    log "Headroom proxy ready on 127.0.0.1:${HEADROOM_PORT}"
}

# What the proxy did for this session, from its own counters - logged rather than reported, because
# the effect that matters is already in the numbers the Direct records: the input tokens and cost
# on the callback come from the harness's own result event, which is what the provider actually
# billed *after* compression. Then the proxy is stopped, so nothing is left running behind the push.
stop_headroom() {
    [[ -n "$HEADROOM_PID" ]] || return 0
    log "Headroom: $(curl -fsS -m 5 "http://127.0.0.1:${HEADROOM_PORT}/stats" 2>/dev/null \
        | jq -c '{mode: .summary.mode, requests: .summary.api_requests, tokensSaved: .summary.compression.total_tokens_saved_all_layers, costSavedUsd: .summary.cost.total_saved_usd}' 2>/dev/null \
        || echo 'stats unavailable')"
    kill "$HEADROOM_PID" 2>/dev/null || true
    HEADROOM_PID=""
}

# Every checkout this container works in, as "<dest>|<sha it started from>|<url>" triples. The
# starting sha is what makes "the agent committed something" answerable without guessing: there is
# no upstream to compare against on a branch that has never been pushed, and an empty branch pushed
# anyway would litter the remote with one dead ref per run that did nothing.
WORKSPACES=()

# The process id of the running agent session, while there is one - see run_claude_code/run_pi
# below. Only the termination trap reads it, to stop the agent making further commits while the
# push it is about to do is in flight.
AGENT_PID=""

remember_workspace() {
    local dest="$1" url="$2"
    WORKSPACES+=("${dest}|$(git -C "$dest" rev-parse HEAD 2>/dev/null || echo '')|${url}")
}

# Pushes whatever the agent committed, while the checkout still exists.
#
# This runs in the harness rather than being left to the agent, because the agent forgetting to push
# is indistinguishable from the agent having nothing to push - and the checkout dies with the
# container, so anything committed and not pushed is destroyed with it. That is not hypothetical: it
# is how an entire implementation run's work was lost, with the run still reporting success. Pushing
# here happens on every exit path - success, failure, and the signals a stopped or evicted container
# is killed with (see the traps below) - so a run that went wrong still leaves its commits somewhere
# a person can look at them.
#
# Safe to call more than once, which is what makes the traps below cheap: a workspace whose head has
# already been pushed records that head as its new starting point, so the next call has nothing to
# do for it. A push that *failed* records nothing, so it is retried instead.
push_workspaces() {
    [[ -z "${DIRECT_BRANCH:-}" ]] && return 0
    [[ ${#WORKSPACES[@]} -eq 0 ]] && return 0
    local index entry dest started_at url head
    for index in "${!WORKSPACES[@]}"; do
        entry="${WORKSPACES[$index]}"
        [[ -z "$entry" ]] && continue
        IFS='|' read -r dest started_at url <<<"$entry"
        head=$(git -C "$dest" rev-parse HEAD 2>/dev/null || echo '')
        if [[ -z "$head" || "$head" == "$started_at" ]]; then
            log "Nothing new committed in ${dest} - not pushing ${DIRECT_BRANCH}"
            continue
        fi

        # Pushed to the URL rather than to the "origin" remote, and with an explicit refspec.
        # A checkout taken from the shared repository cache inherits that cache's config, and the
        # cache is a --mirror clone - so "git push origin <branch>" there dies with
        # "fatal: --mirror can't be combined with refspecs" and the run's commits are lost. Naming
        # the URL sidesteps the mirror configuration entirely, and works the same for an ordinary
        # clone, so both checkout paths push identically.
        if git -C "$dest" push "$url" "HEAD:refs/heads/${DIRECT_BRANCH}"; then
            log "Pushed ${DIRECT_BRANCH} from ${dest}"
            WORKSPACES[index]="${dest}|${head}|${url}"
        else
            log "FAILED to push ${DIRECT_BRANCH} from ${dest} - the work in this checkout is about to be lost"
        fi
    done
}

# What a stopped or evicted worker runs before it goes away.
#
# The Direct stops a worker whenever it sweeps stuck work or a person stops a unit of work by
# hand (Work/Scheduling/WorkDispatcher.cs -> IWorkerRuntime.Stop), and Kubernetes evicts pods for
# reasons of its own - a drained node, a preempted spot instance. All of those arrive as SIGTERM
# to this process, followed by SIGKILL once the grace period runs out
# (KubernetesWorkerRuntime sets TerminationGracePeriodSeconds to leave room for the push below).
# Without this trap the commits made in the container's checkouts are simply destroyed with it,
# which is the one outcome the whole harness-side push exists to prevent.
#
# The agent is killed first so it cannot commit into a checkout mid-push, and the push is best
# effort: whatever is reachable from HEAD at this moment reaches the remote, and anything committed
# after it does not - still strictly better than losing all of it.
on_termination() {
    local signal="$1" number="$2"
    log "Received SIG${signal} - pushing what has been committed before this container goes away"
    if [[ -n "$AGENT_PID" ]]; then
        kill "$AGENT_PID" 2>/dev/null || true
    fi
    if [[ -n "$HEADROOM_PID" ]]; then
        kill "$HEADROOM_PID" 2>/dev/null || true
    fi
    stop_pipe_holder
    push_workspaces

    # The conventional exit status for a shell killed by a signal, so whatever reads this container's
    # exit code sees "terminated by SIGTERM" rather than a plain failure.
    exit $((128 + number))
}

# EXIT covers every ordinary way out of this script, including `fail` and the harness paths' own
# `exit 1` - the two explicit push_workspaces calls further down stay where they are because the
# push has to have happened *before* the run is reported, not merely before the container exits.
# Both are no-ops once the other has pushed.
trap push_workspaces EXIT
trap 'on_termination TERM 15' TERM
trap 'on_termination INT 2' INT

# The container's real stdin, dup'd to a file descriptor that survives into background jobs.
#
# Bash (POSIX async-list behavior, no job control in a non-interactive shell) redirects fd 0 of
# every background command from /dev/null - so the harness feeders below, whose job is to forward
# steering lines arriving on the container's stdin into the running session, read /dev/null when
# they inherit stdin naively: instant EOF, the feeder exits, the pipe it was feeding closes, and
# the CLI sees stdin end underneath it mid-turn. Pi's RPC mode treats that as the client going
# away and exits 0 before a single assistant event ("exited with 0 before settling" - every
# Pi-harness worker ever dispatched died exactly there); the Claude CLI merely finishes its turn,
# which is why that path looked healthy while quietly never receiving a single steering line.
#
# A dup'd fd is not fd 0 and is not touched by the redirection, so `read -u 3` in the feeders
# blocks on the container's actual stdin - held open by the runtime (Docker OpenStdin, the
# Kubernetes Job's Stdin = true) until the pod goes away, and closed with a read failure in a
# container that has none, where the feeders exit and the pipe holders below keep the session
# alive regardless.
#
# No stderr suppression on the exec itself: `exec 3<&0 2>/dev/null` would silence the whole
# script's stderr for good - one error line from a closed fd 0 is the cheaper failure.
exec 3<&0 || true

# The PID of the process holding a harness pipe's write end open for a session's whole lifetime -
# see the harness functions for why that holder exists and what it is for.
PIPE_HOLDER_PID=""

# Stops the pipe holder of the running session, if any - called wherever a session ends (normally,
# on failure, or by signal) so the holder can never outlive the CLI it was holding the pipe for.
stop_pipe_holder() {
    [[ -n "$PIPE_HOLDER_PID" ]] || return 0
    kill "$PIPE_HOLDER_PID" 2>/dev/null || true
    PIPE_HOLDER_PID=""
}

# Clones a repository into a workspace directory. Borrows the objects of a cached bare mirror under
# DIRECT_REPOSITORY_CACHE via `git clone --shared` when one already exists for it, then brings
# that clone current from the remote. Falls back to an ordinary `git clone` otherwise: no cache
# configured at all (every non-Kubernetes/local run), or this is the first time this particular
# repository is needed and the cache does not have an entry for it yet.
#
# Nothing here writes to the cache, and nothing here can: the volume is mounted read-only in this
# container. The Direct's own backend process is its single writer, reacting to GitHub push
# webhooks (see Source/Direct/Repositories/Caching), and it runs `git` inside those mirrors with
# far more privilege than this container has - so a mirror this container could write would be a
# mirror this container could use to run code over there.
clone_into_workspace() {
    local url="$1" dest="$2"
    local without_suffix="${url%.git}"
    local name="${without_suffix##*/}"
    local rest="${without_suffix%/*}"
    local owner="${rest##*/}"
    local cache_repo="${DIRECT_REPOSITORY_CACHE:-}/${owner}/${name}.git"

    if [[ -n "${DIRECT_REPOSITORY_CACHE:-}" && -d "$cache_repo" ]]; then
        # What the work branch is created from. Empty means "wherever the checkout already is",
        # which is what an existing checkout and a failed refresh both fall back to.
        local -a start_point=()

        if [[ ! -d "$dest/.git" ]]; then
            log "Using the cached clone of ${owner}/${name}"

            # The mirror is owned by the backend's user, not this container's, and git refuses to
            # operate on a repository owned by somebody else ("dubious ownership"). Trust exactly
            # this one directory, named literally - safe.directory takes paths, not globs, which is
            # why it goes here per repository rather than as a blanket '*' at startup. Nothing else
            # this container touches is trusted, and the mirror is read-only to it besides.
            git config --global --add safe.directory "$cache_repo"

            # Borrow the cache's objects rather than share them.
            #
            # This used to be `git worktree add` against the cache, and a worktree shares the
            # repository it was taken from - including its object database. So every commit wrote
            # into the cache, which lives on a volume owned by root while this container runs as
            # `agent`, and git refused it:
            #
            #   error: insufficient permission for adding an object to repository database
            #          /repos/<owner>/<name>.git/objects
            #
            # The run could read, build and test perfectly and then not commit a single line - which
            # is exactly how a one-character fix finished green with nothing to show for it and no
            # pull request. A local clone borrows the cache's objects through `alternates` for reads
            # and keeps its own writable object store for anything new, so the checkout is as cheap
            # as a worktree and nothing ever writes to the shared volume.
            git clone --shared "$cache_repo" "$dest" || fail "Could not check out ${owner}/${name} from the cache"

            # Bring the fresh checkout up to the remote's current default branch, in this
            # container's own object store rather than in the cache - the mirror may be a push or
            # two behind, and refreshing it is not this container's business (nor is it permitted
            # to). Cheap: the objects it already borrows through `alternates` are not transferred
            # again, so only the delta since the mirror's last refresh crosses the network.
            #
            # The default branch is asked of the remote rather than read from the mirror's HEAD,
            # which is the one control surface a `+refs/*:refs/*` fetch on the backend side does
            # not heal.
            local default_ref
            default_ref=$(git ls-remote --symref "$url" HEAD 2>/dev/null | awk '/^ref:/ {print $2; exit}')
            if [[ -n "$default_ref" ]] && git -C "$dest" fetch --quiet "$url" "$default_ref"; then
                start_point=(FETCH_HEAD)
            else
                log "Could not refresh ${owner}/${name} from origin - starting from the cached mirror's HEAD"
            fi
        fi

        # A clone of a mirror is an ordinary repository, so the branch is created here rather than
        # by the checkout itself.
        if [[ -n "${DIRECT_BRANCH:-}" ]]; then
            git -C "$dest" checkout -qB "$DIRECT_BRANCH" "${start_point[@]}" || fail "Could not create ${DIRECT_BRANCH} in ${dest}"
        fi
        remember_workspace "$dest" "$url"
        return
    fi

    if [[ ! -d "$dest/.git" ]]; then
        log "Cloning $url"
        git clone "$url" "$dest" || fail "Could not clone $url"
    fi
    if [[ -n "${DIRECT_BRANCH:-}" ]]; then
        git -C "$dest" checkout -B "$DIRECT_BRANCH"
    fi
    remember_workspace "$dest" "$url"
}

# Symlinks the first-listed repository's AI corpus (.claude, .ai) up to the workspace root, for the
# genuinely-multiple-repositories case below.
#
# Claude Code only reads project instructions from its working directory and that directory's
# *ancestors* - never a descendant. So when several repositories each land in their own
# /workspace/<name> folder, /workspace itself has no corpus at all and the agent starts with none
# of this project's conventions loaded (Cratis/Stagehand#603). There is no env var or plumbing that
# says which repository's conventions should win at the root, so this reuses the same rule this file
# already applies elsewhere for picking a single value out of an ordered multi-repository list
# (see tokenOwner/vision selection) - whichever repository was listed first is primary. That is a
# partial mitigation, not a full fix: a repository further down the list still won't have its own
# CLAUDE.md auto-loaded once the agent `cd`s into it, which is why WorkerPrompts spells that out to
# the agent explicitly for the multi-repository case.
#
# Guarded so a repository without a .claude/.ai folder, or a rerun that already created the link,
# does not break anything.
link_primary_corpus() {
    local primary_dest="$1"
    for dir in .claude .ai; do
        if [[ -d "$primary_dest/$dir" && ! -e "/workspace/$dir" ]]; then
            ln -s "$primary_dest/$dir" "/workspace/$dir"
        fi
    done
}

# Clone what the work covers: one repository at the workspace root, or - only when genuinely more
# than one repository is involved - one folder per repository plus a symlinked primary corpus at the
# root (see link_primary_corpus above).
#
# DIRECT_REPOSITORY_URLS is normalized to the single-URL path below even when it (rather than
# DIRECT_REPOSITORY_URL) is what carried the one repository - ad-hoc work, task runs and
# merge-conflict resolution all populate the plural variable regardless of repository count, and
# before this normalization a single-entry DIRECT_REPOSITORY_URLS still nested the checkout under
# /workspace/<name>, leaving /workspace itself without a corpus (Cratis/Stagehand#603).
if [[ -n "${DIRECT_REPOSITORY_URLS:-}" ]]; then
    read -r -a urls <<< "${DIRECT_REPOSITORY_URLS}"
    if [[ ${#urls[@]} -eq 1 ]]; then
        clone_into_workspace "${urls[0]}" /workspace
    else
        for url in "${urls[@]}"; do
            name=$(basename "$url" .git)
            clone_into_workspace "$url" "/workspace/$name"
        done
        link_primary_corpus "/workspace/$(basename "${urls[0]}" .git)"
    fi
elif [[ -n "${DIRECT_REPOSITORY_URL:-}" ]]; then
    clone_into_workspace "${DIRECT_REPOSITORY_URL}" /workspace
fi

# Checked, because this script runs without `set -e`: an unchecked `cd` that fails would leave the
# agent running in the container's default directory against whatever happens to be there, and the
# work would be reported as completed. Fail the unit of work instead.
cd /workspace || fail "Could not enter /workspace"

fetch_build_log

# The prompt arrives as a file (DIRECT_PROMPT_FILE), because it is routinely larger than a
# single environment variable may be - see WorkerPromptFile on the dispatch side. A prompt still
# arriving the old way is written to a file here, so everything below has one code path and never
# has to care which runtime delivered it.
PROMPT_FILE="${DIRECT_PROMPT_FILE:-}"
if [[ -n "$PROMPT_FILE" && -s "$PROMPT_FILE" ]]; then
    log "Prompt read from ${PROMPT_FILE} ($(wc -c < "$PROMPT_FILE") bytes)"
elif [[ -n "${DIRECT_PROMPT:-}" ]]; then
    PROMPT_FILE="$(mktemp)"
    printf '%s' "$DIRECT_PROMPT" > "$PROMPT_FILE"
    log "Prompt read from DIRECT_PROMPT ($(wc -c < "$PROMPT_FILE") bytes)"
else
    log "No prompt provided - nothing to do"
    fail "No prompt provided"
fi

report started "Worker started"

# The Claude Code path - unchanged from before DIRECT_HARNESS existed. Runs whenever
# DIRECT_HARNESS is unset, empty, "claude-code", or anything other than exactly "pi", so every
# existing deployment's behavior stays byte-for-byte identical unless it explicitly opts into Pi.
run_claude_code() {
    log "Starting Claude CLI (model: ${DIRECT_MODEL:-default})"

    CLAUDE_PROFILE_ARGS=()
    if [[ -n "${DIRECT_AI_PROFILE_PROMPT_FILE:-}" ]]; then
        [[ -f "$DIRECT_AI_PROFILE_PROMPT_FILE" ]] || { log "Reviewed AI profile prompt is missing"; exit 1; }
        CLAUDE_PROFILE_ARGS+=(--append-system-prompt-file "$DIRECT_AI_PROFILE_PROMPT_FILE")
    fi

    # Routing the session through the compression proxy is one variable: the CLI is invoked with
    # exactly the same flags either way, and reaches Anthropic through loopback instead of directly.
    # The credential is untouched - load_secrets() exported ANTHROPIC_API_KEY or
    # CLAUDE_CODE_OAUTH_TOKEN, the CLI picks its own up as always, and the proxy forwards the auth
    # headers upstream unread.
    #
    # A session whose ANTHROPIC_BASE_URL is already set is pointed at a provider-specific upstream
    # (a Z.ai provider sets it to Z.ai's Anthropic-compatible endpoint), and must stay there:
    # Headroom speaks the first-party Anthropic API and re-routing the session to it would send
    # Z.ai's credentials to the wrong host. The preset value wins, the proxy idles, and
    # stop_headroom() cleans it up at exit - the same fail-open shape every Headroom path has.
    #
    # ENABLE_TOOL_SEARCH comes with it, and is not optional: Claude Code stops deferring MCP and
    # system tool schemas when ANTHROPIC_BASE_URL names a custom host - which now holds for both
    # paths above - and this session wires in six MCP servers - losing deferral would cost more
    # context than the compression saves. Left overridable, so a deployment that has a reason to
    # turn it off still can.
    if start_headroom; then
        if [[ -n "${ANTHROPIC_BASE_URL:-}" ]]; then
            log "ANTHROPIC_BASE_URL is already set - not routing through Headroom"
        else
            export ANTHROPIC_BASE_URL="http://127.0.0.1:${HEADROOM_PORT}"
            log "Model requests route through Headroom"
        fi
        export ENABLE_TOOL_SEARCH="${ENABLE_TOOL_SEARCH:-true}"
    fi

    MODEL_ARGS=()
    if [[ -n "${DIRECT_MODEL:-}" ]]; then
        MODEL_ARGS+=(--model "${DIRECT_MODEL}")
    fi

    # Wires the report_progress MCP tool into the session (Source/AgentHarnesses/progress-mcp-server.mjs) so
    # the agent can post a live plan/checklist and status updates back to the Direct as it works,
    # not just at the end. DIRECT_PROGRESS_URL/DIRECT_CALLBACK_TOKEN travel through this file's
    # own `env` block rather than relying on the server process inheriting them - written even when
    # the Direct did not set DIRECT_PROGRESS_URL (a bare Docker/local run, say): the tool then
    # reports every call as a soft failure to the agent instead of the Direct, exactly like a
    # failed report over the real network does, rather than needing this script to special-case it
    # away.
    # sequential_thinking/context7/memory/playwright are plain npm-installed tools (Dockerfile.claude)
    # wired in the same way as direct_progress - npm over any other MCP distribution channel, per
    # the organization's stated preference. exa is the one remote server here: Exa's hosted endpoint
    # answers anonymously and rate-limited with no key at all, and EXA_API_KEY (when the Direct
    # handed one out) only lifts that limit via the `x-api-key` header - never a query parameter, and
    # never required. memory's MEMORY_FILE_PATH points at DIRECT_MEMORY_PATH when the Direct set
    # one (see the header comment), falling back to a container-local path so the tool still works
    # standalone. playwright runs Chromium headless and sandboxless (Dockerfile.claude installs the
    # browser under a non-root-readable path with no user namespace assumed) - see
    # --executable-path/--cdp-endpoint in @playwright/mcp's own --help for attaching a debugger.
    if [[ -n "${DIRECT_MEMORY_PATH:-}" ]]; then
        mkdir -p "$(dirname "$DIRECT_MEMORY_PATH")"
    fi

    MCP_CONFIG=/tmp/mcp-config.json
    jq -cn \
        --arg progress_url "${DIRECT_PROGRESS_URL:-}" \
        --arg token "${DIRECT_CALLBACK_TOKEN:-}" \
        --arg memory_path "${DIRECT_MEMORY_PATH:-/tmp/mcp-memory.jsonl}" \
        --arg exa_key "${EXA_API_KEY:-}" \
        '{
            mcpServers: {
                direct_progress: {
                    command: "node",
                    args: ["/usr/local/lib/direct-progress-mcp/progress-mcp-server.mjs"],
                    env: {
                        DIRECT_PROGRESS_URL: $progress_url,
                        DIRECT_CALLBACK_TOKEN: $token
                    }
                },
                sequential_thinking: {
                    command: "mcp-server-sequential-thinking",
                    args: []
                },
                context7: {
                    command: "context7-mcp",
                    args: []
                },
                memory: {
                    command: "mcp-server-memory",
                    args: [],
                    env: {
                        MEMORY_FILE_PATH: $memory_path
                    }
                },
                playwright: {
                    command: "playwright-mcp",
                    args: ["--headless", "--browser", "chromium", "--no-sandbox"]
                },
                exa: ({
                    type: "http",
                    url: "https://mcp.exa.ai/mcp"
                } + (if $exa_key != "" then {headers: {"x-api-key": $exa_key}} else {} end))
            }
        }' > "$MCP_CONFIG"

    PIPE=/tmp/claude-in
    mkfifo "$PIPE"

    # The pipe's write end is held open for the whole session by a dedicated process, independent of
    # the feeder below. The CLI must never see stdin end while its turn is in flight or waiting for
    # steering: with the holder, a feeder that exits early (a container with no stdin attached, a
    # runtime that closed it) costs only the ability to steer, never the session. Stopped by
    # stop_pipe_holder wherever the session ends.
    sleep infinity > "$PIPE" &
    PIPE_HOLDER_PID=$!

    # Feeder: the initial prompt, then every line arriving on the container's stdin becomes a
    # steering message to the running session. Reads fd 3 - the container's real stdin dup'd above -
    # because a background job's inherited fd 0 is /dev/null (see the exec 3<&0 note). Killed when
    # the session produces its result, which - together with the holder's own stop - closes the
    # pipe and lets the CLI exit.
    {
        wrap_user_message_file "$PROMPT_FILE"
        while IFS= read -r -u 3 line; do
            [[ -n "$line" ]] && wrap_user_message "$line"
        done
    } > "$PIPE" &
    FEEDER_PID=$!

    CLAUDE_EXIT_FILE=/tmp/claude-exit
    rm -f "$CLAUDE_EXIT_FILE"

    # GNU time's own report of the wrapped command's resource usage (Cratis/Stagehand#638) - CPU time
    # and peak memory, aggregated across the claude process and any subprocesses it spawns for tool
    # calls (getrusage(RUSAGE_CHILDREN), which -v reports from). `time` returns the wrapped command's
    # own exit status, so PIPESTATUS[0] below still reflects claude's exit code, not time's.
    TIME_FILE=/tmp/claude-time
    rm -f "$TIME_FILE"

    # Run as a background job and `wait` for it, rather than in the foreground.
    #
    # This is what makes the TERM/INT traps above able to fire at all. Bash defers a trap for a
    # signal received while it is waiting for a *foreground* command until that command completes,
    # and Kubernetes signals only this process, not the agent it spawned - so with the session in
    # the foreground the trap would not run until the agent finished on its own, which it never does
    # before SIGKILL arrives, and the container's commits would go with it. `wait` is the one
    # exception: a trapped signal makes it return immediately and the handler runs there and then.
    # The exit status travels through a file because the pipeline runs in the background job's own
    # subshell, where PIPESTATUS is not visible from here.
    {
        /usr/bin/time -v -o "$TIME_FILE" -- claude -p \
            --input-format stream-json \
            --output-format stream-json \
            --verbose \
            --dangerously-skip-permissions \
            --mcp-config "$MCP_CONFIG" \
            "${CLAUDE_PROFILE_ARGS[@]}" \
            "${MODEL_ARGS[@]}" < "$PIPE" |
        while IFS= read -r event; do
            printf '%s\n' "$event"
            printf '%s\n' "$event" >> "$STREAM_FILE"
            if [[ "$(jq -r '.type // empty' <<<"$event" 2>/dev/null)" == "result" ]]; then
                kill "$FEEDER_PID" 2>/dev/null || true
                stop_pipe_holder
            fi
        done
        printf '%s' "${PIPESTATUS[0]}" > "$CLAUDE_EXIT_FILE"
    } &
    AGENT_PID=$!
    wait "$AGENT_PID"
    AGENT_PID=""
    CLAUDE_EXIT=$(cat "$CLAUDE_EXIT_FILE" 2>/dev/null || echo '')
    CLAUDE_EXIT=${CLAUDE_EXIT:-1}
    kill "$FEEDER_PID" 2>/dev/null || true
    stop_pipe_holder

    RESULT_EVENT=$(jq -c 'select(.type == "result")' "$STREAM_FILE" 2>/dev/null | tail -1)
    RESULT=$(jq -r '.result // empty' <<<"$RESULT_EVENT" 2>/dev/null)
    INPUT_TOKENS=$(jq -r '(.usage.input_tokens // 0) + (.usage.cache_creation_input_tokens // 0) + (.usage.cache_read_input_tokens // 0)' <<<"$RESULT_EVENT" 2>/dev/null || echo 0)
    OUTPUT_TOKENS=$(jq -r '.usage.output_tokens // 0' <<<"$RESULT_EVENT" 2>/dev/null || echo 0)
    COST=$(jq -r '.total_cost_usd // 0' <<<"$RESULT_EVENT" 2>/dev/null || echo 0)
    DURATION=$(jq -r '.duration_ms // 0' <<<"$RESULT_EVENT" 2>/dev/null || echo 0)
    CPU_SECONDS=$(claude_cpu_seconds_from_time_file "$TIME_FILE")
    MEMORY_BYTES=$(claude_memory_bytes_from_time_file "$TIME_FILE")

    # The session is over, so the proxy has nothing left to serve - reported to the log and stopped
    # before the push, on both the success and the failure path below.
    stop_headroom

    # Before reporting anything: the Direct acts on the report, so the branch has to be on
    # the remote by the time it arrives. The EXIT trap pushes too, but only after that.
    push_workspaces

    if [[ ${CLAUDE_EXIT} -ne 0 || -z "$RESULT_EVENT" ]]; then
        log "Claude CLI exited with ${CLAUDE_EXIT}"
        report failed "${RESULT:-Claude CLI exited with ${CLAUDE_EXIT}}" 0 0 0 0 "$CPU_SECONDS" "$MEMORY_BYTES"
        exit 1
    fi

    report completed "${RESULT:-Work completed}" "$INPUT_TOKENS" "$OUTPUT_TOKENS" "$COST" "$DURATION" "$CPU_SECONDS" "$MEMORY_BYTES"
    log "Done"
}

# The Pi path - drives the Pi coding agent CLI (@earendil-works/pi-coding-agent) over its
# `--mode rpc` newline-delimited JSON protocol instead of Claude Code. Verified against the real,
# installed 0.84.3 CLI (`--help`, docs/rpc.md, and live handshake/event-stream probing) rather than
# guessed - see the flags and event handling below for what that verification actually settled.
#
# Two things about Pi's RPC mode do not work the way Claude Code's stream-json mode does, and both
# shape this function:
#
#   1. Pi's RPC process does not reliably exit on stdin EOF. A plain, immediately-closed pipe made it
#      exit - but before the in-flight turn even finished. A FIFO whose sole writer dies (the same
#      shape run_claude_code's own feeder/kill pattern above relies on) left the process running
#      indefinitely in testing. So this function never waits for Pi to exit on its own: it recognizes
#      completion from the event stream itself (`agent_settled`), asks two more RPC commands for the
#      final result text and usage/cost, and then kills the process explicitly.
#   2. `agent_settled` fires whether the turn succeeded or failed - Pi reports a failed completion as
#      an ordinary assistant message with `stopReason: "error"` (or `"aborted"`) rather than a
#      nonzero process exit or a distinct failure event. So success/failure here is read from that
#      field, not from the Pi process's own exit code or from reaching agent_settled at all.
#
# Pi has no MCP mechanism of any kind in 0.84.x (verified: no flag, no settings key, nothing in its
# own bundled code or documentation) - report_progress does not carry over to this path. A real gap,
# left as one rather than faked with a bogus tool.
#
# pi-mcp-adapter (npm) is the closest thing to a fix - an extension that lets Pi speak MCP through a
# proxy tool - but it cannot be wired in here. --no-extensions below is not scoped to project-local
# extensions the way --no-approve is: the installed 0.84.3 CLI's own resource loader
# (dist/core/resource-loader.js in @earendil-works/pi-coding-agent) resolves `noExtensions` to
# `extensionPaths = cliEnabledExtensions` - dropping every discovered path (global
# ~/.pi/agent/extensions/, project .pi/extensions/, *and* packages installed via `pi install`, which
# resolve through the same settings-driven package manager) and keeping only paths passed explicitly
# via -e/--extension on the same invocation. A globally `pi install`-ed pi-mcp-adapter would therefore
# never load under the current invocation - confirmed by reading that source, not guessed - so it is
# not installed here. The only way to load it anyway would be an explicit `-e npm:pi-mcp-adapter@<pinned>`
# flag alongside --no-extensions, which is a deliberate exception to the untrusted-repo trust boundary
# --no-extensions exists for and needs a human call, not an agent's - left as a follow-up rather than
# guessed into place. --no-extensions itself stays regardless: it is still what keeps a cloned
# repository's own .pi/extensions and .mcp.json/.pi/mcp.json from running with the CLI's full,
# unsandboxed permissions.

# Azure OpenAI and a self-hosted OpenAI-compatible gateway both need setup beyond
# DIRECT_PROVIDER/DIRECT_MODEL alone before pi starts - see the DIRECT_PROVIDER/
# DIRECT_PROVIDER_ENDPOINT/AZURE_OPENAI_API_KEY/DIRECT_PROVIDER_API_KEY entries in the header
# comment above for what each variable carries. Verified against the real, installed 0.84.3 CLI and
# its @earendil-works/pi-ai dependency's source, not assumed from documentation alone:
#
#   - azure-openai-responses is one of Pi's own built-in providers, driven entirely by environment
#     variables it reads natively (AZURE_OPENAI_API_KEY, AZURE_OPENAI_BASE_URL) - no config file, and
#     nothing this function does beyond exporting the base URL, since load_secrets() has already
#     exported the key.
#   - An OpenAI-compatible gateway is not a Pi vendor at all, so it has to be declared as a custom
#     provider in ~/.pi/agent/models.json (docs/models.md) - loaded from plain disk with no network
#     call, so this works under --offline exactly like every other provider here. Only "id" is
#     required in a model entry (pi-coding-agent/dist/core/provider-composer.js defaults everything
#     else - contextWindow, maxTokens, name), so the single configured model is declared with nothing
#     Direct does not already know. The API key is written *by reference*
#     (`"apiKey": "$DIRECT_PROVIDER_API_KEY"`) so pi's own config loader interpolates it against
#     its process environment rather than the literal value ever touching this file - the same
#     out-of-band-secret discipline the GITHUB_TOKEN credential helper above applies, and for the
#     same reason. When no key is configured, pi's openai-completions client still always sends
#     whatever key resolves as an `Authorization: Bearer` header (verified in pi-ai's source - there
#     is no "send no header" path the way Direct's own direct HTTP client for this provider type
#     has), so an unauthenticated gateway gets the harmless placeholder docs/models.md's own example
#     for exactly this case uses, rather than a broken or empty header.
#
# Headroom routing (DIRECT_HEADROOM, issue #586 extending #556) piggybacks on this same function,
# gated on whether start_headroom() actually got the proxy up (HEADROOM_PID set - run_pi() always
# calls start_headroom before this function, precisely so that check is meaningful here). Unlike
# Claude Code, Pi's built-in providers do not read ANTHROPIC_BASE_URL/OPENAI_BASE_URL (verified in
# @earendil-works/pi-ai's provider source - anthropic.js and openai.js both hardcode their baseUrl),
# so routing them through the proxy instead goes through the same models.json
# `providers.<id>.baseUrl` override mechanism every custom provider here already uses (verified in
# pi-coding-agent's provider-composer.js: a configured baseUrl replaces the built-in one for every
# model of that provider). Every case is fail-open: HEADROOM_PID unset (proxy missing, dead, or never
# asked for) leaves the provider configured exactly as it is today, direct to the real endpoint.
#   - anthropic/openai: the plain Claude-path convention (bare host for the Anthropic Messages API,
#     `/v1` suffix for OpenAI's Responses API - openai.js's own built-in baseUrl already carries that
#     suffix, so the override mirrors it) - no model or key entry needed, only the baseUrl.
#   - direct-openai-compatible: baseUrl points at the proxy instead of the real gateway; the real
#     gateway becomes Headroom's own upstream via --openai-api-url, passed by run_pi() when it starts
#     the proxy (see start_headroom() above).
#   - azure-openai-responses (issue #646): AZURE_OPENAI_BASE_URL points at the proxy's `/v1` path
#     instead of the real resource; the real resource's `/openai` path becomes Headroom's own upstream
#     via --openai-api-url, passed by run_pi() when it starts the proxy (see start_headroom() above) -
#     see the header comment's DIRECT_HEADROOM entry for the source-level detail on why both need
#     the explicit path.
configure_pi_provider() {
    local headroom_base="http://127.0.0.1:${HEADROOM_PORT}"

    case "${DIRECT_PROVIDER:-}" in
        anthropic)
            [[ -n "$HEADROOM_PID" ]] || return 0
            local agent_dir="${HOME}/.pi/agent"
            mkdir -p "$agent_dir"
            jq -n --arg baseUrl "$headroom_base" \
                '{providers: {anthropic: {baseUrl: $baseUrl}}}' \
                > "${agent_dir}/models.json"
            ;;
        openai)
            [[ -n "$HEADROOM_PID" ]] || return 0
            local agent_dir="${HOME}/.pi/agent"
            mkdir -p "$agent_dir"
            jq -n --arg baseUrl "${headroom_base}/v1" \
                '{providers: {openai: {baseUrl: $baseUrl}}}' \
                > "${agent_dir}/models.json"
            ;;
        openai-codex)
            # Not routed through Headroom, for the same reason azure-openai-responses is not - see the
            # DIRECT_HEADROOM header comment. This provider talks to the ChatGPT backend rather than
            # to an OpenAI-shaped API, so pointing it at the local proxy would need Headroom to speak
            # that protocol; until it does, routing it would break the session rather than observe it.
            #
            # Pi's own credential store, seeded rather than logged into: `pi` authenticates this
            # provider through an interactive OAuth flow that a worker container has no way to run,
            # so the record minted once on a person's machine is carried here instead. Writing the
            # file is all that is needed - Pi reads it as its own, and refreshes the credential from
            # the refresh token inside it when the access token expires, which is the whole reason
            # the subscription travels as a record rather than as a bare token.
            local agent_dir="${HOME}/.pi/agent"
            mkdir -p "$agent_dir"

            # --argjson parses the record rather than embedding it as a string, so a malformed one
            # fails here instead of reaching Pi as a credential shaped like nothing it knows. The
            # Direct already refuses an unusable record at dispatch; this is the second line of
            # that same defence, and it says so rather than leaving an empty file behind.
            if jq -n \
                --arg provider "$DIRECT_PROVIDER" \
                --argjson credential "${DIRECT_PI_OAUTH_CREDENTIAL:-null}" \
                '{($provider): $credential}' > "${agent_dir}/auth.json.tmp" 2>/dev/null; then
                mv "${agent_dir}/auth.json.tmp" "${agent_dir}/auth.json"
                chmod 600 "${agent_dir}/auth.json"
                log "Seeded Pi's credential store for ${DIRECT_PROVIDER}"
            else
                rm -f "${agent_dir}/auth.json.tmp"
                log "Could not read the ${DIRECT_PROVIDER} subscription credential - the session will not authenticate"
            fi
            ;;
        zai)
            # Nothing to configure: Pi declares its own zai provider, fixed to Z.ai's public
            # endpoint, and reads ZAI_API_KEY from the environment directly (load_secrets()
            # exports it like every other credential). The case exists to say that explicitly -
            # a provider id with no case reads as forgotten rather than deliberate.
            log "Using Pi's built-in Z.ai provider"
            ;;
        azure-openai-responses)
            if [[ -n "$HEADROOM_PID" ]]; then
                export AZURE_OPENAI_BASE_URL="${headroom_base}/v1"
            else
                export AZURE_OPENAI_BASE_URL="${DIRECT_PROVIDER_ENDPOINT:-}"
            fi
            ;;
        direct-openai-compatible)
            local agent_dir="${HOME}/.pi/agent"
            mkdir -p "$agent_dir"

            local api_key_value='unused'
            if [[ -n "${DIRECT_PROVIDER_API_KEY:-}" ]]; then
                # Unexpanded on purpose, the same security property as the GITHUB_TOKEN credential
                # helper above: this literal string reaches models.json so pi's own config loader
                # resolves it against its process environment per request, rather than the key value
                # ever being written to the file.
                # shellcheck disable=SC2016
                api_key_value='$DIRECT_PROVIDER_API_KEY'
            fi

            local base_url="${DIRECT_PROVIDER_ENDPOINT:-}"
            if [[ -n "$HEADROOM_PID" ]]; then
                base_url="${headroom_base}/v1"
            fi

            jq -n \
                --arg baseUrl "$base_url" \
                --arg model "${DIRECT_MODEL:-}" \
                --arg apiKey "$api_key_value" \
                '{providers: {"direct-openai-compatible": {baseUrl: $baseUrl, api: "openai-completions", apiKey: $apiKey, models: [{id: $model}]}}}' \
                > "${agent_dir}/models.json"
            ;;
    esac
}

# Samples the Pi process's own peak resident set size and cumulative CPU time from /proc
# (Cratis/Stagehand#638) - unlike run_claude_code's `time -v` wrapping, `pi`'s real PID is relied on
# by the TERM/INT traps (AGENT_PID=$PI_PID below), so it cannot be wrapped without replacing that PID
# with the wrapper's own. This only measures the `pi` process itself, not subprocesses it spawns for
# tool calls - a known, acceptable approximation absent a cgroup-based alternative. Updates the
# running-maximum PI_PEAK_MEMORY_BYTES and the latest PI_CPU_SECONDS; a no-op once the process has
# exited and /proc/$pid is gone.
sample_pi_usage() {
    local pid="$1"
    if [[ -r "/proc/$pid/status" ]]; then
        local hwm_kb
        hwm_kb=$(awk '/^VmHWM:/ { print $2 }' "/proc/$pid/status" 2>/dev/null)
        if [[ -n "$hwm_kb" ]]; then
            local hwm_bytes=$((hwm_kb * 1024))
            [[ $hwm_bytes -gt $PI_PEAK_MEMORY_BYTES ]] && PI_PEAK_MEMORY_BYTES=$hwm_bytes
        fi
    fi
    if [[ -r "/proc/$pid/stat" ]]; then
        # Field 2 (comm) is parenthesized and may itself contain spaces, so everything up to the
        # last ") " is stripped before splitting the remaining, fixed-width fields. utime/stime are
        # fields 14/15 overall, i.e. 12/13 (indices 11/12) in the remainder.
        local stat rest fields utime stime
        stat=$(cat "/proc/$pid/stat" 2>/dev/null)
        rest="${stat#*) }"
        read -ra fields <<<"$rest"
        utime="${fields[11]:-}"
        stime="${fields[12]:-}"
        if [[ -n "$utime" && -n "$stime" ]]; then
            PI_CPU_SECONDS=$(awk -v u="$utime" -v s="$stime" -v tck="$PI_CLK_TCK" 'BEGIN { printf "%.3f", (u + s) / tck }')
        fi
    fi
}

run_pi() {
    log "Starting Pi CLI (provider: ${DIRECT_PROVIDER:-anthropic}, model: ${DIRECT_MODEL:-default})"

    # The worker image owns this allow-list. --no-extensions below disables global and project
    # discovery; these explicit local package roots are the only reviewed extension code Pi loads.
    # shellcheck source=/dev/null
    source /usr/local/share/direct/pi-extension-allow-list.sh

    PI_PEAK_MEMORY_BYTES=0
    PI_CPU_SECONDS=0
    PI_CLK_TCK=$(getconf CLK_TCK 2>/dev/null || echo 100)

    PI_MODEL_ARGS=()
    PI_PROFILE_ARGS=()
    if [[ -n "${DIRECT_AI_PROFILE_PROMPT_FILE:-}" ]]; then
        [[ -f "$DIRECT_AI_PROFILE_PROMPT_FILE" ]] || { log "Reviewed AI profile prompt is missing"; exit 1; }
        PI_PROFILE_ARGS+=(--append-system-prompt "$(cat "$DIRECT_AI_PROFILE_PROMPT_FILE")")
    fi
    if [[ -n "${DIRECT_MODEL:-}" ]]; then
        PI_MODEL_ARGS+=(--model "${DIRECT_MODEL}")
    fi

    PI_STREAM_FILE=/tmp/pi-stream.jsonl
    : > "$PI_STREAM_FILE"
    PI_DONE_MARKER=/tmp/pi-done
    PI_REJECTED_FILE=/tmp/pi-rejected
    PI_CONSUMER_DONE=/tmp/pi-consumer-done
    rm -f "$PI_DONE_MARKER" "$PI_REJECTED_FILE" "$PI_CONSUMER_DONE"

    PIPE=/tmp/pi-in
    mkfifo "$PIPE"

    # The pipe's write end is held open for the whole session by a dedicated process, independent of
    # the feeder below - the piece whose absence killed every Pi session: Pi's RPC mode treats a
    # closed stdin as the client leaving and exits 0 mid-turn, before a single assistant event, so
    # the fifo may never close while the session is expected to keep running. Stopped by
    # stop_pipe_holder on every session-end path below.
    sleep infinity > "$PIPE" &
    PIPE_HOLDER_PID=$!

    # Feeder: the initial prompt as a `prompt` command, then every line arriving on the container's
    # stdin becomes a `steer` command queued into the running session - Pi's own dedicated command
    # for injecting text into an already-running turn (see wrap_pi_prompt/wrap_pi_steer above). Reads
    # fd 3 - the container's real stdin dup'd near the top of this file - because a background job's
    # inherited fd 0 is /dev/null (see the exec 3<&0 note there). Killed once the session settles,
    # alongside the Pi process itself (see the function comment above).
    {
        wrap_pi_prompt_file "$PROMPT_FILE"
        while IFS= read -r -u 3 line; do
            [[ -n "$line" ]] && wrap_pi_steer "$line"
        done
    } > "$PIPE" &
    FEEDER_PID=$!

    # Headroom (DIRECT_HEADROOM, issue #586, azure-openai-responses added by #646): started before
    # configure_pi_provider() so that function can see whether the proxy actually came up (HEADROOM_PID)
    # and wire the provider at it only then - the same fail-open ordering run_claude_code() uses.
    # --openai-api-url is only needed for the two providers whose real endpoint is otherwise unknown to
    # Headroom (anthropic/openai use Headroom's own vendor defaults):
    #   - direct-openai-compatible: Headroom wants a bare origin and appends its own
    #     /v1/chat/completions, so a configured endpoint that already carries /v1 (the OpenAI-SDK-style
    #     convention DIRECT_PROVIDER_ENDPOINT follows) is stripped here to avoid doubling it up.
    #   - azure-openai-responses: DIRECT_PROVIDER_ENDPOINT is the bare resource origin
    #     (AzureOpenAIProviderClient.cs uses it directly as the prefix before
    #     /openai/deployments/...), so Headroom's upstream needs /openai appended to land requests on
    #     the same .../openai/v1/responses path Pi's direct client would target.
    HEADROOM_ARGS=()
    if [[ "${DIRECT_PROVIDER:-}" == "direct-openai-compatible" && -n "${DIRECT_PROVIDER_ENDPOINT:-}" ]]; then
        HEADROOM_ARGS=(--openai-api-url "${DIRECT_PROVIDER_ENDPOINT%/v1}")
    elif [[ "${DIRECT_PROVIDER:-}" == "azure-openai-responses" && -n "${DIRECT_PROVIDER_ENDPOINT:-}" ]]; then
        HEADROOM_ARGS=(--openai-api-url "${DIRECT_PROVIDER_ENDPOINT%/}/openai")
    fi
    start_headroom "${HEADROOM_ARGS[@]}" && log "Model requests route through Headroom"

    configure_pi_provider

    PI_STARTED_AT=$(date +%s%3N)

    # --no-approve/--no-extensions: a cloned repository is untrusted input, and Pi's project-local
    # settings/extensions are arbitrary code that would otherwise run with the CLI's own full
    # permissions (Pi has no built-in sandbox or per-tool approval step at all - verified against
    # docs/security.md and docs/containerization.md - so there is no "skip permissions" flag to pass
    # the way claude -p needs --dangerously-skip-permissions; declining project trust is the
    # equivalent safety decision here). --no-session: this container is thrown away after one unit of
    # work. --no-skills/--no-prompt-templates/--no-themes: no such resources ship in this image - the
    # Claude Skills vendored for Cratis/Stagehand#118 live under the Claude image's ~/.claude/skills
    # (see Dockerfile.claude) in a format Pi 0.84.x has no loader for, so they stay unused here rather
    # than half-applied.
    # --offline: skips Pi's own startup version/catalog network calls, verified to still resolve
    # --model patterns correctly (catalogs ship built into the package). --tools: the full built-in
    # toolset by name, matching Claude Code's default tool availability - grep/find/ls are off by
    # default in Pi 0.84.x otherwise. --provider is always DIRECT_PROVIDER, resolved server-side
    # against the Direct's own approved-providers allow-list - never a value this script invents.
    pi --mode rpc \
        --no-session \
        --no-approve \
        --offline \
        --no-extensions \
        "${PI_EXTENSION_ARGS[@]}" \
        --no-skills \
        --no-prompt-templates \
        --no-themes \
        --provider "${DIRECT_PROVIDER:-anthropic}" \
        --tools read,bash,edit,write,grep,find,ls \
        "${PI_PROFILE_ARGS[@]}" \
        "${PI_MODEL_ARGS[@]}" < "$PIPE" > >(
            while IFS= read -r event; do
                printf '%s\n' "$event"
                printf '%s\n' "$event" >> "$PI_STREAM_FILE"
                EVENT_TYPE=$(jq -r '.type // empty' <<<"$event" 2>/dev/null)
                if [[ "$EVENT_TYPE" == "agent_settled" ]]; then
                    printf '%s\n' '{"id":"direct-final-text","type":"get_last_assistant_text"}' > "$PIPE"
                    printf '%s\n' '{"id":"direct-final-stats","type":"get_session_stats"}' > "$PIPE"
                fi
                if [[ "$(jq -r '.id // empty' <<<"$event" 2>/dev/null)" == "direct-final-stats" ]]; then
                    touch "$PI_DONE_MARKER"
                fi

                # The `prompt` command can itself come back rejected - "success: false means the
                # prompt was rejected before acceptance" per docs/rpc.md, verified firsthand: a
                # session with no usable credential for the selected provider gets exactly this,
                # synchronously, and never starts a turn at all - no agent_start, no agent_settled,
                # nothing the checks above would ever see. Caught here as its own, distinct, terminal
                # outcome rather than falling through to the generic "exited before settling" failure
                # (accurate, but discards the one line of the whole session that says why).
                if [[ "$EVENT_TYPE" == "response" ]] &&
                    [[ "$(jq -r '.command // empty' <<<"$event" 2>/dev/null)" == "prompt" ]] &&
                    [[ "$(jq -r '.success' <<<"$event" 2>/dev/null)" == "false" ]]; then
                    jq -r '.error // "Pi rejected the prompt"' <<<"$event" 2>/dev/null > "$PI_REJECTED_FILE"
                    touch "$PI_DONE_MARKER"
                fi
            done

            # Marks the event-consuming subshell's own completion, distinct from the Pi process
            # dying. The two are not the same moment: this reads from Pi's stdout through the process
            # substitution's own pipe, which can still hold buffered, unprocessed lines - including
            # the very "prompt rejected" line above - after the Pi process itself has already exited.
            # Waiting on process liveness alone raced this subshell and lost often enough in testing
            # to be worth this explicit marker instead.
            touch "$PI_CONSUMER_DONE"
        ) &
    PI_PID=$!

    # Published for the TERM/INT traps, so a stopped or evicted container stops the agent before it
    # pushes. The polling loop below keeps this path interruptible without the background-and-wait
    # dance run_claude_code needs: the foreground command a signal can land during is a 0.1s sleep.
    AGENT_PID=$PI_PID

    # Waits for the two follow-up responses above, or for a rejected prompt, or for this subshell's
    # own consumer to finish reading everything Pi ever wrote (see the comment on PI_CONSUMER_DONE
    # above) - not for Pi's own process to exit, and not merely for it to die, per the function
    # comment above. A generous 180s safety ceiling applies to this round trip specifically, not to
    # the work itself, which agent_settled has by definition already finished.
    PI_WAITED=0
    while [[ ! -f "$PI_DONE_MARKER" ]] && [[ ! -f "$PI_CONSUMER_DONE" ]] && [[ $PI_WAITED -lt 1800 ]]; do
        sample_pi_usage "$PI_PID"
        sleep 0.1
        PI_WAITED=$((PI_WAITED + 1))
    done
    sample_pi_usage "$PI_PID"

    kill "$FEEDER_PID" 2>/dev/null || true
    stop_pipe_holder
    kill "$PI_PID" 2>/dev/null || true
    wait "$PI_PID" 2>/dev/null
    PI_EXIT=$?
    AGENT_PID=""

    # The session is over one way or another (settled, rejected, or the process died before either) -
    # reported to the log and stopped here, once, so every exit path below - both early failures and
    # the normal success/failure branches further down - is covered by this single call.
    stop_headroom

    if [[ ! -f "$PI_DONE_MARKER" ]]; then
        log "Pi CLI exited with ${PI_EXIT} before settling"
        report failed "Pi CLI exited with ${PI_EXIT} before completing" 0 0 0 0 "$PI_CPU_SECONDS" "$PI_PEAK_MEMORY_BYTES"
        exit 1
    fi

    if [[ -f "$PI_REJECTED_FILE" ]]; then
        REJECTION=$(cat "$PI_REJECTED_FILE")
        log "Pi rejected the prompt: ${REJECTION}"
        report failed "${REJECTION:-Pi rejected the prompt}" 0 0 0 0 "$PI_CPU_SECONDS" "$PI_PEAK_MEMORY_BYTES"
        exit 1
    fi

    LAST_ASSISTANT_EVENT=$(jq -c 'select(.type == "message_end" and .message.role == "assistant")' "$PI_STREAM_FILE" 2>/dev/null | tail -1)
    STOP_REASON=$(jq -r '.message.stopReason // empty' <<<"$LAST_ASSISTANT_EVENT" 2>/dev/null)
    ERROR_MESSAGE=$(jq -r '.message.errorMessage // empty' <<<"$LAST_ASSISTANT_EVENT" 2>/dev/null)

    FINAL_TEXT_EVENT=$(jq -c 'select(.type == "response" and .id == "direct-final-text")' "$PI_STREAM_FILE" 2>/dev/null | tail -1)
    FINAL_STATS_EVENT=$(jq -c 'select(.type == "response" and .id == "direct-final-stats")' "$PI_STREAM_FILE" 2>/dev/null | tail -1)
    RESULT=$(jq -r '.data.text // empty' <<<"$FINAL_TEXT_EVENT" 2>/dev/null)

    # get_session_stats reports cacheRead/cacheWrite apart from input - summed into INPUT_TOKENS the
    # same way Claude's cache_creation/cache_read fields are, for a comparable figure across harnesses.
    INPUT_TOKENS=$(jq -r '(.data.tokens.input // 0) + (.data.tokens.cacheRead // 0) + (.data.tokens.cacheWrite // 0)' <<<"$FINAL_STATS_EVENT" 2>/dev/null || echo 0)
    OUTPUT_TOKENS=$(jq -r '.data.tokens.output // 0' <<<"$FINAL_STATS_EVENT" 2>/dev/null || echo 0)
    COST=$(jq -r '.data.cost // 0' <<<"$FINAL_STATS_EVENT" 2>/dev/null || echo 0)

    # Pi's RPC protocol reports no duration anywhere in its own events (unlike Claude's `result` event,
    # which carries duration_ms directly) - computed here from wall-clock instead.
    DURATION=$(( $(date +%s%3N) - PI_STARTED_AT ))

    # Before reporting anything: the Direct acts on the report, so the branch has to be on
    # the remote by the time it arrives. The EXIT trap pushes too, but only after that.
    push_workspaces

    if [[ "$STOP_REASON" == "error" || "$STOP_REASON" == "aborted" ]]; then
        log "Pi agent turn ended with stopReason=${STOP_REASON}"
        report failed "${ERROR_MESSAGE:-Pi agent turn ended with stopReason ${STOP_REASON}}" "$INPUT_TOKENS" "$OUTPUT_TOKENS" "$COST" "$DURATION" "$PI_CPU_SECONDS" "$PI_PEAK_MEMORY_BYTES"
        exit 1
    fi

    report completed "${RESULT:-Work completed}" "$INPUT_TOKENS" "$OUTPUT_TOKENS" "$COST" "$DURATION" "$PI_CPU_SECONDS" "$PI_PEAK_MEMORY_BYTES"
    log "Done"
}

prepare_ai_profile_prompt() {
    local manifest="${DIRECT_AI_CONFIGURATION_MANIFEST:-}"
    local directory="${DIRECT_AI_PROFILE_DIRECTORY:-}"
    [[ -z "$manifest" || -z "$directory" ]] && return 0

    local workspace="${DIRECT_WORKSPACE_ROOT:-/workspace}"
    local output=/tmp/direct-ai-profile-prompt.md
    : > "$output"
    while IFS= read -r profile; do
        local repository_has_profile=false
        while IFS= read -r repository_config; do
            if jq -e --arg profile "$profile" '.profiles // [] | index($profile) != null' "$repository_config" >/dev/null 2>&1; then
                repository_has_profile=true
                break
            fi
        done < <(find "$workspace" -path '*/.cratis/ai.json' -type f -print 2>/dev/null)
        [[ "$repository_has_profile" == true ]] && continue

        local profile_file="${directory}/ai-profile-${profile//\//-}.md"
        [[ -f "$profile_file" ]] || { log "Reviewed AI profile content is missing for ${profile}"; exit 1; }
        printf '\n\n' >> "$output"
        cat "$profile_file" >> "$output"
    done < <(jq -r '.items[] | select(.kind == "Profile" and .enabled == true) | .id' "$manifest")

    if [[ -s "$output" ]]; then
        export DIRECT_AI_PROFILE_PROMPT_FILE="$output"
    else
        unset DIRECT_AI_PROFILE_PROMPT_FILE
    fi
}

validate_ai_configuration_manifest() {
    local manifest="${DIRECT_AI_CONFIGURATION_MANIFEST:-}"
    [[ -z "$manifest" ]] && return 0
    [[ -f "$manifest" ]] || { log "AI configuration manifest is missing"; exit 1; }

    jq -e '
        (.harness | type == "string") and
        (.items | type == "array") and
        (all(.items[];
            (.id | type == "string" and length > 0) and
            (.source | type == "string" and (startswith("npm:") or startswith("cratis-ai:"))) and
            (.origin == "Global" or .origin == "Repository") and
            (.enabled == true)))' "$manifest" >/dev/null || {
        log "AI configuration manifest is invalid"
        exit 1
    }

    if grep -Eqi 'api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential' "$manifest"; then
        log "AI configuration manifest contains a secret-shaped field"
        exit 1
    fi

    log "Validated $(jq '.items | length' "$manifest") resolved AI configuration item(s)"
}

validate_ai_configuration_manifest
prepare_ai_profile_prompt

if [[ "${DIRECT_HARNESS:-}" == "pi" ]]; then
    run_pi
else
    run_claude_code
fi
