# Find out why a registered author is missing from the listing

1. Reference `Cratis.Chronicle`. If you have the append result, check `result.IsSuccess` and keep `result.SequenceNumber`. Otherwise read `eventStore.EventLog.GetForEventSourceIdAndEventTypes` for the author and registration event type, identify the intended occurrence and take its `Context.SequenceNumber`. Keep the author's event source ID and observer ID. The default ID for the listing projection is its model's full name (`Library.Features.Authors.Listing.Author`); for a reactor it is the reactor class's full name. Use the configured ID instead if explicitly overridden. Use the same store, namespace and event sequence as the write.
2. Read `await eventStore.Observers.GetAll()` and look for the expected ID.
   - If the observer is missing, verify the scope and ID. On the host that registers `Author`, inspect `eventStore.Registration.Failure` and `eventStore.Registration.Artifacts.FirstOrDefault(a => a.ArtifactType == typeof(Author))?.Failure`. The former reports a run failure; the latter reports failure of that projection. A missing entry or `eventStore.Registration.HasRun == false` doesn't establish a failure. With no observer to compare, don't report lag.
   - If the observer is present, check `observer.RunningState` and compare positions only on the same event sequence. For a write at 20 and a last-handled position of 15, next position 16 means the observer is behind.
3. Only if you have the accepted append result, use `var completion = await result.WaitForCompletion();` from `Cratis.Chronicle.Observation` and inspect `completion.FailedPartitions`. With or without that result, use `await eventStore.FailedPartitions.GetFailedPartitionsFor(observer.Id)` and match `failure.Partition.Value` to the author ID for this projection. For other observers, first resolve their actual partition key. A failure in a different partition is not evidence that this partition failed.

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

To summarize captured attempts without printing their payloads, run `node scripts/summarize-failure.mjs /absolute/path/to/attempts.json` from this skill's installed directory. Pass a JSON array with `sequenceNumber` and `kind` for each attempt.

## When it goes off the usual path

- **You cannot run the .NET calls:** open the deployment's configured Chronicle Workbench URL. Select the affected store and namespace and open **Observers** for the observer's positions. In **Failed partitions**, select its failed partition and follow the latest attempt's sequence number. Verify the store, namespace and sequence in **Sequences**. Share positions and failure metadata, not payloads.
- **Catch-up or replay is already running:** use `eventStore.Jobs.GetJobs()` and open `eventStore.Jobs.GetJob(id)` only for the matching job. A null result is not evidence of completion.

## Avoid

- Don't interpret an unavailable position as a large position ahead of the write.
- Don't use client health or an observer's position alone to declare the author's read model current.
- Stop at the diagnosis. Don't retry a partition, remove an observer, stop a job or start replay. Give the operator the affected identities, positions and likely repeated effects before seeking separate repair approval.

## Related skills

- [Check the reactor's delivery handling](../../cratis-chronicle-react-to-fact/SKILL.md) if retrying an announcement could send it twice.

- [Check the original append](../../cratis-chronicle-record-event/SKILL.md)
- [Diagnose the live query connection](../../cratis-arc-diagnose-live-query/SKILL.md)
