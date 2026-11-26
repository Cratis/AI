---
name: cratis-chronicle-inspect-observer
description: Use when a Chronicle read model is stale and observer positions or failed partitions might explain a missing update, such as an accepted registration absent from the author listing. Not for repairing a live query connection (use cratis-arc-diagnose-live-query).
compatibility: .NET SDK; Node.js for offline summaries.
---

# Find out why a registered author is missing from the listing

1. Reference `Cratis.Chronicle`. Check `result.IsSuccess`; keep `result.SequenceNumber`, the author's event source ID and the observer ID. The default ID for the listing projection is its model's full name (`Library.Features.Authors.Listing.Author`); for a reactor it is the reactor class's full name. Use the configured ID instead if explicitly overridden. Use the same store, namespace and event sequence as the write.
2. Read `await eventStore.Observers.GetAll()`. Find the observer by ID, check `observer.RunningState` and compare its positions only when the event sequence matches. For a write at 20 and a last-handled position of 15, next position 16 means the observer is behind.
3. For the accepted append, use `var completion = await result.WaitForCompletion();` from `Cratis.Chronicle.Observation` and inspect `completion.FailedPartitions`. Use `await eventStore.FailedPartitions.GetFailedPartitionsFor(observer.Id)` and match `failure.Partition.Value` to the affected event source ID. A failure for another author doesn't explain this one.
4. To check a job, use `await eventStore.Jobs.GetJobs()` and `await eventStore.Jobs.GetJob(id)`. A null result means that job wasn't found, not that it completed.

```csharp
// Features/Authors/Diagnostics/AuthorListingProgress.cs
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Observation;

namespace Library.Features.Authors.Diagnostics;

public static class AuthorListingProgress
{
    public static string ComparePosition(ObserverInformation observer, EventSequenceId sequence, ulong write)
    {
        if (observer.EventSequenceId != sequence) return "Different sequence: do not compare positions";
        var last = observer.LastHandledEventSequenceNumber;
        if (!last.IsActualValue || last.Value < write)
            return observer.NextEventSequenceNumber.IsActualValue
                ? $"Behind; next position is {observer.NextEventSequenceNumber.Value}"
                : "No actual next position reported";
        return "Position reached; check this author's failed partition and read model";
    }
}
```

To summarize captured attempts without printing their payloads, run `node scripts/summarize-failure.mjs attempts.json`. Pass a JSON array with `sequenceNumber` and `kind` for each attempt.

## Avoid

- Don't interpret an unavailable position as a large position ahead of the write.
- Don't use client health or an observer's position alone to declare the author's read model current.
- Don't remove an observer, stop a job or start replay to diagnose progress.

## Related skills

- [Check the original append](../cratis-chronicle-record-event/SKILL.md)
- [Diagnose the live query connection](../cratis-arc-diagnose-live-query/SKILL.md)
