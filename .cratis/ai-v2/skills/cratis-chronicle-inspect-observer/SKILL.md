---
name: cratis-chronicle-inspect-observer
description: Use when a Chronicle observer lags, a projection stops advancing, or an observer partition has failed. Not for missing observable query emissions after the view updated (cratis-arc-diagnose-live-query).
---

# Locate the stalled delivery before recovering it

1. Identify store, namespace, event sequence, observer and affected partition. Obtain the expected matching fact position rather than assuming every event in the log matches. Read references/workbench.md when examining the Workbench. **Done:** one scoped observation binds the missing output to a specific input.
2. Compare last handled and next positions with the matching input. Check running state, failed partitions, attempts, redacted exception category, and active jobs. An observer-wide checkpoint can advance while one partition is failed. **Done:** distinguish a backlog that is progressing from a recorded failure; if the view already has the row, give that row and query to `cratis-arc-diagnose-live-query`.
For client-side inspection start with `await store.Observers.GetObserversWithState()`. Select the matching `ObserverInformation.Id` and `EventSequenceId`. Read `await store.FailedPartitions.GetFailedPartitionsFor(observer.Id)` for the same scope; compare `FailedPartition.Partition`, `IsResolved` and each attempt's `SequenceNumber` instead of printing its payload or stack trace.

3. For failure, check the dependency and whether an external effect already happened. Propose retry of the affected partition only after the cause is fixed and output is safe to repeat. Read references/replay-cost.md when state itself must be rebuilt. **Done:** record a bounded recovery proposal, its separate approval requirement and the exact position and output that would confirm recovery. Do not start a job while diagnosing.

Run `dotnet build Specs --configuration Release -warnaserror` then `dotnet test Specs --configuration Release --no-build` from the example fixture; expect a failed-partition observation to win over generic lag. No retry, rewind or replay is part of this check.
