# 0012 - IWorkerRuntime.Start returns an outcome, not exceptions, for anticipated results

## Status

Accepted

## Context

Decision 0011 ported `IWorkerRuntime`/`DockerWorkerRuntime`/`KubernetesWorkerRuntime` from Direct
unchanged in shape - including three exception types (`WorkerIsAlreadyRunning`,
`WorkerIsStillGoingAway`, `WorkerLaunchWasRefused`) thrown by `Start` for three entirely anticipated,
recoverable outcomes: a live worker already running, a previous worker still terminating, and a
cluster-side transient failure. Every caller was structured as one `try` wrapping three `catch`
blocks, each doing real application work - recording a specific dispatch impediment, deciding
whether to keep a callback token. This was caught mid-session as a real violation of
`.cratis/ai/rules/csharp.md`'s "Exceptions" section (strengthened in the same session, PR #354):
exceptions are for unrecoverable state, and none of these three outcomes are unrecoverable - they are
ordinary branches a caller is expected to take.

## Decision

- `IWorkerRuntime.Start` now returns `Task<WorkerLaunchOutcome>` instead of `Task`.
  `WorkerLaunchOutcome` is a plain enum naming all four real outcomes: `Started`, `AlreadyRunning`,
  `StillGoingAway`, `RefusedByCluster`. No `Result<TResult, TError>` wrapper was needed - there is no
  remaining outcome here that is a genuine "error" rather than one of these four ordinary branches, so
  a bare enum return is the honest shape rather than dressing it up in a monad that has no real
  failure case left to carry.
- Deleted `WorkerIsAlreadyRunning`, `WorkerIsStillGoingAway`, `WorkerLaunchWasRefused` entirely - not
  deprecated, not kept alongside the new shape. Their `IsAboutTheCluster` classification logic moved
  into `KubernetesWorkerRuntime` as a private static method, since it is only ever consulted from
  `Start`'s own exception filter now (the one exception filter this method still has - guarding
  against exactly the class of transient cluster failure that becomes `RefusedByCluster` rather than
  propagating).
- `DockerWorkerRuntime.Start` always returns `WorkerLaunchOutcome.Started` on success - the Docker
  runtime has no equivalent of the anticipated "previous worker still around" cases the Kubernetes
  runtime accounts for. A genuine failure there (the daemon itself unreachable) is unrecoverable from
  this runtime's own perspective and still propagates as an exception, which is the correct use of one
  per the same rule.
- Added spec coverage for the two branches that previously threw
  (`for_KubernetesWorkerRuntime/when_launching/and_the_previous_worker_is_still_alive`,
  `and_there_is_no_previous_worker`), adapted from Direct's own donor specs, using a fake
  `IKubernetesClientFactory` the way Direct's originals did.

## Consequences

- Every caller of `IWorkerRuntime.Start` - none exist inside `Cratis.AI` itself yet, since Direct is
  the only consumer and has not adopted this runtime yet - must switch from `try`/`catch` to a
  `switch` on the returned `WorkerLaunchOutcome` when it does. This is deliberately a breaking
  interface change caught before any real consumer exists, rather than after.
- This decision is itself an instance of the corpus rule PR #354 landed in the same session - the
  rule was written and released first specifically so this fix, and every future PR in this
  repository, is held to it from the moment it exists, not retrofitted quietly later.
