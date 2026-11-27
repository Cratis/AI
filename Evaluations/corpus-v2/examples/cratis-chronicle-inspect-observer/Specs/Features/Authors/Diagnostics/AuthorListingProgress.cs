using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Observation;
using Xunit;

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

public class Diagnosis
{
    static string ComparePosition(ObserverInformation observer, EventSequenceId sequence, ulong write) =>
        AuthorListingProgress.ComparePosition(observer, sequence, write);

    static string Describe(ObserverInformation observer, string partition, ulong needed, IEnumerable<FailedPartition> scopedFailures)
    {
        var failed = scopedFailures.SingleOrDefault(f => !f.IsResolved && f.ObserverId == observer.Id && f.Partition.Value == partition);
        if (failed is not null)
        {
            var attempt = failed.Attempts.MaxBy(a => a.Occurred);
            if (attempt is null) return "Unresolved failure without attempt details; inspect before recovery";
            return $"{observer.Id.Value}/{partition}: {attempt.Kind} at {attempt.SequenceNumber.Value}; seek approval for scoped retry";
        }
        return !observer.LastHandledEventSequenceNumber.IsActualValue || observer.LastHandledEventSequenceNumber.Value < needed ? "Behind; compare next snapshot" : "Check downstream output";
    }
    [Fact]
    public void isolates_a_failed_partition_without_exposing_its_payload()
    {
        var observer = new ObserverInformation("notices", EventSequenceId.Log, ObserverType.Reactor, ObserverRunningState.Active, 15, 16, 15);
        Assert.StartsWith("Different sequence", ComparePosition(observer, EventSequenceId.Outbox, 20));
        Assert.Equal("Behind; next position is 16", ComparePosition(observer, EventSequenceId.Log, 20));
        var unstarted = observer with { LastHandledEventSequenceNumber = EventSequenceNumber.Unavailable, NextEventSequenceNumber = 0, HandledEventCount = 0 };
        Assert.Equal("Behind; next position is 0", ComparePosition(unstarted, EventSequenceId.Log, 0));
        Assert.Equal("No actual next position reported", ComparePosition(unstarted with { NextEventSequenceNumber = EventSequenceNumber.Unavailable }, EventSequenceId.Log, 0));
        var failure = new FailedPartition(Guid.NewGuid(), observer.Id, "author-a", [new FailedPartitionAttempt(DateTimeOffset.UtcNow, 9, ["private payload"], "private stack", FailureKind.Timeout)]);
        Assert.Equal("notices/author-a: Timeout at 9; seek approval for scoped retry", Describe(observer, "author-a", 9, [failure]));
        Assert.Equal("Behind; compare next snapshot", Describe(observer, "author-b", 20, [failure]));
        Assert.Equal("Check downstream output", Describe(observer, "author-a", 9, [failure with { IsResolved = true }]));
    }
}
