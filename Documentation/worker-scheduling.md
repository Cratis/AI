---
title: Kubernetes worker scheduling
description: Batch packing and autoscaler eviction protection for Kubernetes workers.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

`KubernetesWorkerRuntime` uses `WorkerRuntimeOptions.NodePoolWorkload` to select nodes
with the matching `workload` label and tolerate the matching `NoSchedule` taint.
An omitted, null, empty, or whitespace value leaves node placement unrestricted.

## Batch packing

Only the exact value `batch` enables packing. Worker pods prefer nodes hosting either:

- Pods labeled `actions-ephemeral-runner=True`.
- Pods labeled `app.kubernetes.io/managed-by=cratis-ai-agents`.

Each alternative is a separate preferred pod-affinity term with weight 100 and
`kubernetes.io/hostname` topology. An empty `namespaceSelector: {}` matches all
namespaces, so runners and workers do not need to share a namespace. This selector
behavior is stable in Kubernetes 1.24 and later; see
[Kubernetes inter-pod affinity namespace selection](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#namespace-selector).

Batch workers omit the soft topology-spread constraint that would counteract packing.
Other pools, including `compute` and `data`, retain the existing soft spread and gain
no packing affinity. Resource requests, limits, node selectors, and tolerations still
apply. Packing is a preference, not a requirement: the first worker can start without
an existing matching pod, and capacity can place subsequent workers elsewhere.

## Restricted checkout cache isolation

A shared repository cache exposes source from repositories beyond a job's checkout list,
even when mounted read-only. When `WorkerJob.EnvironmentVariables` contains
`DIRECT_REPOSITORY_CHECKOUTS`, both `KubernetesWorkerRuntime` and `DockerWorkerRuntime`
omit the configured repository-cache PVC or bind mount and its environment variable.
They also remove caller-supplied `DIRECT_REPOSITORY_CACHE` and the configured cache
variable. Presence of the checkout key is sufficient, including an empty contract;
invalid checkout contracts remain the entrypoint's responsibility to reject.

Ordinary jobs retain their existing cache mounts and environment. Restricted jobs
clone fresh instead. Upgrade the `Cratis.AI` runtime package as well as the harness
images: an entrypoint-only upgrade cannot remove a mount supplied by an older runtime.
This closes the shared-cache source-read path, not every possible credential, network,
or consumer-supplied file exposure.

## Running-worker protection

Every worker pod template carries
`cluster-autoscaler.kubernetes.io/safe-to-evict: "false"`, alongside its existing
managed-by and network-policy labels. This asks Cluster Autoscaler not to evict the
pod during scale-down, independently of a PodDisruptionBudget. It does not prevent
explicit deletion, node failure, or other eviction mechanisms. See the
[Cluster Autoscaler scale-down exclusions](https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node).

The runtime retains its 120-second termination grace period, credential mount,
non-root execution, and resource declarations.

## Deadlines and mounted configuration

`WorkerRuntimeOptions.WorkerDeadline` sets the Kubernetes Job's
`ActiveDeadlineSeconds` (default: 48 hours). The last optional parameter of
`WorkerJob`, `TimeSpan? Deadline = null`, overrides that setting for one job.
A non-positive job value falls back to the option; a non-positive option falls
back to 48 hours. Positive fractional seconds round up. Docker has no equivalent
and ignores both settings.

Before contacting the cluster, `Start` counts the UTF-8 bytes of every mounted
file: rendered credentials, prompt, configuration files, and readiness marker.
The payload budget is 1,032,192 bytes: the Kubernetes Secret limit of 1 MiB minus
a 16 KiB safety margin for serialization and metadata. An oversized payload
returns `WorkerLaunchOutcome.ConfigurationTooLarge`, without creating or removing
anything. The error log names the total bytes, budget, and three largest files
with their byte counts, never their contents. Reduce the configuration before
retrying; the refusal is not a transient cluster failure.

## Bundle-in, diff-out workers

Use `DIRECT_RUN_MODE=bundle-diff` when you want generated changes back for your
own verifier rather than granting the worker repository access. Keep configuration
files to `prompt.md` and `request.json`; send the tree as a git bundle, not as
mounted source files. Unset or any other run-mode value keeps the existing behavior.

The mode accepts these ordinary environment variables:

| Variable | Contract |
| --- | --- |
| `DIRECT_BUNDLE_URL` | Required HTTP GET target for a self-contained git bundle. |
| `DIRECT_RESULT_URL` | Required HTTP POST target for the result JSON. |
| `DIRECT_REQUEST_FILE` | Required mounted `request.json` path. `.baseCommit` must be a full commit hash present in the bundle; other fields are for the agent, not interpreted by the worker. |
| `DIRECT_PROMPT_FILE` | Mounted `prompt.md` path, using the existing prompt-file contract. |
| `DIRECT_CALLBACK_URL` | Existing start/completion/failure callback. |
| `DIRECT_PROGRESS_URL` | Optional phase and Claude agent progress POST target. |
| `DIRECT_CORRELATION` | Optional opaque JSON object, forwarded without interpreting its keys. Invalid JSON or a non-object logs a warning and becomes `{}`. |
| `DIRECT_CONTEXT_MCP_URL` | Optional read-only HTTP MCP endpoint, configured as Claude server `context` only when its token is also supplied. |
| `DIRECT_WORK_ID` | Phase `runId`. |
| `DIRECT_HARNESS`, `DIRECT_MODEL`, `DIRECT_PROVIDER` | Existing harness and model selection. Claude Code is the V1 target; Pi and Copilot also deliver results, without MCP. |
| `DIRECT_STRUCTURED_RESULT_FILE` | Worker-exported `/tmp/agent-result.json`, outside `/workspace`. Tell the agent in your prompt to write its optional structured result there. |

Deliver credentials through the existing `DIRECT_SECRETS_FILE` mount, not the
container specification. `DIRECT_CALLBACK_TOKEN` authenticates bundle GET, result
POST, callbacks, and phases with `Authorization: Bearer`. Optional
`DIRECT_CONTEXT_MCP_TOKEN` authenticates the Claude context server with the same
header shape. Provider credentials retain their existing names and handling.

The worker refuses even empty settings of `GITHUB_TOKEN`, `GH_TOKEN`,
`DIRECT_PUSH_TOKEN_URL`, `DIRECT_CLONE_CREDENTIALS`, `DIRECT_REPOSITORY_URL`,
`DIRECT_REPOSITORY_URLS`, `DIRECT_REPOSITORY_CHECKOUTS`, or `DIRECT_BRANCH`.
It verifies the bundle and checks out `baseCommit` on a local branch in
`/workspace`, without configuring a remote, cloning remotely, or pushing.
A local git identity is supplied when you do not provide one. This mode's
entrypoint contract is not a network sandbox: isolate the worker and expose
only the context and result capabilities it needs.

The optional agent result file contains `{outcome, gaps, summary, selfChecks}`.
It must be one JSON object; `outcome` and `summary`, when provided, are strings,
and `gaps` and `selfChecks` are arrays. Missing or invalid content falls back to
empty arrays and the harness's final result text. Only `outcome: "Refused"`
changes the worker-computed outcome. `touchedFiles` always comes from git,
never from the agent.

The result POST carries this shape:

```json
{
  "diff": "",
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "structured": {
    "outcome": "NoChanges",
    "touchedFiles": [],
    "gaps": [],
    "summary": "No changes needed",
    "selfChecks": []
  },
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0,
    "costUsd": 0,
    "durationMs": 0,
    "cpuSeconds": 0,
    "memoryBytes": 0,
    "model": "",
    "provider": "anthropic",
    "harness": "claude-code"
  },
  "correlation": {}
}
```

The worker stages committed, uncommitted, and untracked non-ignored changes,
then captures one `git diff --binary` against the baseline. The SHA-256 covers
the exact diff bytes in the JSON string, including trailing newlines. Both the
diff and POST body travel through files, not command-line arguments.

Outcomes are `Completed` for a non-empty diff, `NoChanges` for an empty diff,
`Refused` only when declared by the agent, and `Cancelled` on termination.
These describe delivery, not acceptance. `selfChecks` are advisory claims;
only your verifier decides whether to accept the changes.

A successful result POST precedes the `diffReady` phase and the existing
`completed` callback with usage. Exhausted result-delivery retries produce
`failed` with `Could not deliver the result` and exit 1, never completion.
An agent failure uses the existing failure callback and sends no result.
Usage follows the harness's measurements; unavailable measurements are zero,
including usage not yet finalized when cancelled.

All three harnesses emit phases in order: `started`, `cloned` (bundle checked
out), `agentRunning`, `diffReady`. Each POST uses the existing progress shape
with `note` plus these fields:

```json
{
  "note": "cloned",
  "schemaVersion": 1,
  "kind": "phase",
  "phase": "cloned",
  "sequence": 2,
  "timestamp": "2026-10-09T12:00:00Z",
  "harness": "claude-code",
  "runId": "work-id",
  "correlation": {}
}
```

Sequence numbers start at 1 and timestamps are UTC ISO-8601. A phase POST
failure is logged and does not fail the run; its retries are short and bounded.
Claude's existing `report_progress` MCP tool remains available independently.

On SIGTERM the worker stops the agent process tree, captures the partial diff,
and attempts a `Cancelled` result POST with at most 35 seconds of HTTP retry
and request time, within the pod's 120-second grace period. It exits 143 and
never pushes or reports successful completion. Cancellation before checkout
has no workspace diff to deliver. SIGINT follows the same path with exit 130.
