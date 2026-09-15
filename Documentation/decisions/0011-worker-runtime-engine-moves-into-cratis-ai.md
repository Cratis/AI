# 0011 - Worker runtime engine moves into Cratis.AI

## Status

Accepted

## Context

`ai-consolidation-plan.md` Section 5.6 calls for Direct's `Work/Workers/` runtime implementations -
`DockerWorkerRuntime`, `KubernetesWorkerRuntime`, and their supporting types - to move into
`Cratis.AI/Workers/` alongside the abstractions (`IWorkerRuntime`, `WorkerJob`, `WorkerRuntimeOptions`,
`IKubernetesClientFactory`) that already moved in an earlier PR. Decision 0010 moved the Docker images
these runtimes launch; this decision moves the .NET code that launches them.

## Decision

- Ported `WorkerSecrets`, `WorkerPromptFile`, `WorkerResources`, `DockerWorkerRuntime`,
  `KubernetesWorkerRuntime`, the three worker-launch failure types (`WorkerIsAlreadyRunning`,
  `WorkerIsStillGoingAway`, `WorkerLaunchWasRefused`), `WorkerRuntimeLog`, and
  `WorkerRuntimeServiceCollectionExtensions` into `Cratis.AI.Workers`. `WorkId` generalized to
  `AgentSessionId` throughout, matching the abstractions already ported.
- `WorkerRuntimeOptions` (which already carried Direct's `ContainerRuntimeOptions` reasoning verbatim,
  including the incident-derived resource-sizing remarks) gained `RepositoryCachePath`,
  `RepositoryCacheClaimName`, and `RepositoryCacheEnvironmentVariable` - all configurable rather than
  hard-coded, because Direct's original values name Direct-owned infrastructure directly: the PVC is
  literally provisioned as `stagehand-repository-cache`, and the environment variable is
  `DIRECT_REPOSITORY_CACHE` - part of the harness env-var contract decision 0010 already chose not to
  rename. A consumer configures these three to whatever its own infrastructure and `entrypoint.sh`
  contract actually use; the package no longer assumes Direct's names.
- Renamed everything that was a publishing/runtime *identity* rather than a domain concept, matching
  decision 0010's precedent: container/Job names (`direct-work-{id:N}` → a shared
  `DockerWorkerRuntime.NameFor` helper producing `cratis-ai-agent-<sanitized-session-id>`, used by
  both runtimes so they agree on one contract), the Kubernetes NetworkPolicy selector label
  (`direct.cratis.io/workload` → `cratis.io/agent-workload` - a consumer's own NetworkPolicy must be
  updated to this exact value when it adopts this runtime), and the `managed-by` label
  (`cratis-stagehand` → `cratis-ai-agents`).
- Did **not** rename the `DIRECT_SECRETS_FILE`/`DIRECT_PROMPT_FILE`/`DIRECT_PROMPT` environment
  variable names inside `WorkerSecrets`/`WorkerPromptFile`, or the internal `/run/agent-secrets`
  mount directory's *variable names* - `entrypoint.sh` still reads those three names literally
  (confirmed by grep before this port), so changing them here without changing `entrypoint.sh` in
  lockstep would silently break every worker. The mount directory *path itself*
  (`/run/direct-secrets` → `/run/agent-secrets`) was safe to rename because `entrypoint.sh` never
  hard-codes it - it only reads whatever path the two `_FILE` variables point at.
- `WorkerEnvironment.cs` was confirmed, again, not to move - it is Direct's own orchestration built
  entirely from Direct's own domain state. See decision 0010 for the fuller reasoning; nothing about
  it changed with this PR.

## Consequences

- A consumer adopting this runtime for the first time (Studio, eventually) must independently
  provision its own NetworkPolicy (or equivalent) selecting on `cratis.io/agent-workload`, and its own
  `RepositoryCache*` configuration if it wants the shared-cache optimization at all - none of that is
  assumed by the package.
- Direct, when it eventually cuts over to this runtime (not yet done - Direct still runs its own
  copies of these classes as of this PR), must configure `RepositoryCacheEnvironmentVariable` to
  `DIRECT_REPOSITORY_CACHE` and `RepositoryCacheClaimName` to `stagehand-repository-cache` explicitly,
  to keep `entrypoint.sh` and its existing PVC working unchanged.
- Ported a meaningful but partial slice of Direct's own spec coverage for these classes (the
  pure-function `BuildContainerSpecification`/`BuildJobSpecification` "no repository cache" /
  "repository cache configured" / "credentials never appear in the serialized specification" cases).
  Direct's fuller suite (`for_KubernetesWorkerRuntime/when_launching/*`, `when_judging_whether_a_worker_*`,
  and several more `when_building_the_job_specification/*` cases covering node-pool pinning, resource
  requests, image-pull secrets, and topology spread) was not ported in this PR - tracked as follow-up.
