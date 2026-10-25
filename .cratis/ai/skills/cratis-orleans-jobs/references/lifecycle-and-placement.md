<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Lifecycle, recovery and placement

## Stop, drain and admission

Requires Cratis.Orleans 1.20.0 for `IJob.StopAndDrain()` / `StopAndDrain(JobStopReason)`. Unlike `Stop()`, which acknowledges durable intent, drain waits until the old execution can no longer schedule work, perform activation callbacks or report outcomes, and terminal state is durable. A stop timeout is not a successful drain. A job stopped before completion remains stopped across rehydration; only an explicit resume starts it again. Persistence failures are refusals, not successful stops or starts.

Implement singleton `IJobAdmissionPolicy` for mutual exclusion in a host's scope/namespace. `JobAdmissionRequest` supplies the incoming and durable active jobs; return `JobAdmissionDecision.Allow()` or `Refuse(...)`. In the policy, drain a conflicting job **before** allowing a replacement and impose a host-owned timeout. If draining is refused, times out, or throws, refuse the new job. Ordinary `Stop` is not sufficient, because its background work may still be active. `IJobsManager.Start` serializes admission for a scope/namespace; direct `IJob.Start` bypasses admission. Decide exactly which host jobs are mutually exclusive rather than globally blocking all jobs.

## Bounded delivery and retries

Requires 1.21.0 for these opt-in execution controls. Defaults preserve unbounded dispatch, one execution attempt and no lease timeout:

| Option | Default / meaning |
| --- | --- |
| `MaxActiveStepsPerJob` | `null` (all); a positive limit fills a dispatch window within a stage |
| `MaxStepAttempts` | `1`, including first attempt; failed work can retry when increased |
| `StepRetryBackoff`, `MaxStepRetryBackoff` | `5 seconds`, `5 minutes`; capped exponential delay |
| `JobWatchdogInterval` | `1 minute`; probes stalled delivery/progress |
| `StepLeaseTimeout` | `TimeSpan.Zero` disables heartbeat lease enforcement |
| `StepDeliveryMaxAttempts` | `10` |
| `StepDeliveryRetryDelay`, `MaxStepDeliveryRetryDelay` | `1 second`, `30 seconds` |

A missed heartbeat cannot prove work stopped. A lease-timeout retry is fenced until the prior run settles; it never starts two runs at once. Attempts/checkpoints survive reactivation, and retry resumes the checkpoint, not necessarily the beginning. Delivery exhaustion reaches a failure instead of leaving an unscheduled step forever. Late/duplicate outcomes do not count twice. Derived execution timers should use `ScheduleJobWork`; a raw grain timer can overlap lifecycle callbacks.

`IJob.RetryFailed()` reopens failed work on a `CompletedWithFailures` job; `IJobsManager.RetryFailedSteps(jobId)` returns `Result<int, RetryFailedStepsError>`. It resets failed steps' attempts, skips successful work, and lets previously unreachable later stages run. It is not a general rerun of a successful job. Keep step effects idempotent despite fencing.

## Step test runs

Requires 1.22.0 for `StartJobStepTestRun` and `GetJobStepTestRun` on `IJobsManager` and `IJobStepTestRun`. This starts one prepared step under an isolated test-run job id, with its own state. It does not rewrite the original job's state. Inspect the result; successful values exist only when the step produces one. Removal of the original step can make starting its test run fail. Isolated state is not isolated external effects: authorize the target and use safe dependencies. Results are in-memory on that test-run activation and expire; query promptly instead of treating them as durable receipts.

## Custom storage and rolling upgrades

Persist the complete `JobState`, including `StopFinalized`, `StoppedStepsCounted` and `CompletedStepsCounted`. Missing lists read as empty for old records; do not project these fields away when storing state. The completion list tracks outcomes in executions begun by resume/retry, not jobs never resumed, and warns at 100,000 entries. Cross-version code that does not persist the list can lose duplicate protection, so keep mixed-version windows short.

A completed stop sets `StopFinalized` after all required notifications have succeeded. Unfinalized stops are retried; finalized stops are excluded from recovery through `IJobStorage.GetJobsExcludingFinalizedStops`. Custom providers can override its default in-memory filtering to filter in storage. MongoDB and SQL filter there; MongoDB adds `status_stopFinalized`. SQLite, PostgreSQL and SQL Server jobs storage are supported; MySQL/MariaDB is not. Removing jobs likewise retries unacknowledged notifications; acceptance of removal is not quiescence or immediate physical deletion.

## Independent controller and worker placement

Requires 1.30.0 for `Cratis.Orleans.Hosting` extensions on `ISiloBuilder`:

- `AddJobPlacement()` or `AddJobPlacement<TDirector>()` opts controllers into `JobsPlacementStrategy`.
- `AddJobStepPlacement()` or `AddJobStepPlacement<TDirector>()` opts workers into `JobStepsPlacementStrategy`, including recovered steps.
- Directors implement Orleans `IPlacementDirector`. Host directors decide eligibility; throw `NoEligibleJobWorker` when no silo is eligible. Orleans does not retry that exception; the job's failure handling applies.
- Without an opt-in, controller placement remains resource-optimized and workers use the cluster default. The built-in directors preserve those defaults when an opt-in has no custom director.
- **Wait until every silo runs the supporting version**, then register each strategy identically on every silo. Do not introduce the strategy during a mixed-version rollout.

`UseJobStepParallelismFromSiloMetadata()` independently sizes each silo's throttle from the positive integer `cratis.jobs.max-parallel-steps` metadata value (or the supplied metadata key). Missing, nonnumeric or nonpositive values fall back to `JobsOptions.MaxParallelSteps` and its processor-count default. Publish with Orleans `UseSiloMetadata`. This is a startup value, not live resizing, authorization or admission. Keep controller placement, worker eligibility, execution throttling and job admission as separate choices.
