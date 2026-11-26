---
name: cratis-chronicle-inspect-observer
compatibility: Node.js for the offline failure summary; .NET SDK for the application spec.
description: Use when a Chronicle observer lags, a projection stops advancing, or an observer partition has failed. Not for missing observable query emissions after the view updated (cratis-arc-diagnose-live-query).
---

# Locate the stalled delivery before recovering it

1. Identify store, namespace, event sequence, observer and affected partition. Obtain the expected matching fact position rather than assuming every event in the log matches. Read references/workbench.md when examining the Workbench. **Done:** one scoped observation binds the missing output to a specific input.
2. Compare last handled and next positions with the matching input. Check running state, failed partitions, attempts, redacted exception category, and active jobs. An observer-wide checkpoint can advance while one partition is failed. **Done:** distinguish a backlog that is progressing from a recorded failure; if the view already has the row, give that row and query to [Locate the first missing emission](../cratis-arc-diagnose-live-query/SKILL.md).
For client-side inspection start with `await store.Observers.GetObserversWithState()`. Select the matching `ObserverInformation.Id` and `EventSequenceId`. Read `await store.FailedPartitions.GetFailedPartitionsFor(observer.Id)` for the same scope; compare `FailedPartition.Partition`, `IsResolved` and each attempt's `SequenceNumber` instead of printing its payload or stack trace.

3. For failure, check the dependency and whether an external effect already happened. Propose retry of the affected partition only after the cause is fixed and output is safe to repeat. Read references/replay-cost.md when state itself must be rebuilt. **Done:** record a bounded recovery proposal, its separate approval requirement and the exact position and output that would confirm recovery. Do not start a job while diagnosing.

Select unresolved records within the store, namespace and sequence already under investigation:

```csharp
        var failed = scopedFailures.SingleOrDefault(f => !f.IsResolved && f.ObserverId == observer.Id && f.Partition.Value == partition);
```

For one selected partition, save its attempts locally as a JSON array with numeric `sequenceNumber` and string `kind` per attempt. Run `node scripts/summarize-failure.mjs <attempts.json>` from the skill directory; it prints positions and allowlisted failure categories without identifiers, messages or stacks. It does not connect or retry.

Run `dotnet test -c Release` in the application's diagnosis spec project. An unresolved failure for the selected partition must take precedence over the observer checkpoint; a resolved or unrelated failure must not.
