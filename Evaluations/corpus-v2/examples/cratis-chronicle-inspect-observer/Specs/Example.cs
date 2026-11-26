using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Observation;
using Xunit;

public class Diagnosis
{
    static string Describe(ObserverInformation observer, string partition, ulong needed, IEnumerable<FailedPartition> scopedFailures)
    {
        var failed = scopedFailures.SingleOrDefault(f => !f.IsResolved && f.ObserverId == observer.Id && f.Partition.Value == partition);
        if (failed is not null)
        {
            var attempt = failed.Attempts.MaxBy(a => a.Occurred);
            if (attempt is null) return "Unresolved failure without attempt details; inspect before recovery";
            return $"{observer.Id.Value}/{partition}: {attempt.Kind} at {attempt.SequenceNumber.Value}; seek approval for scoped retry";
        }
        return observer.LastHandledEventSequenceNumber.Value < needed ? "Behind; compare next snapshot" : "Check downstream output";
    }
    [Fact]
    public void isolates_a_failed_partition_without_exposing_its_payload()
    {
        var observer = new ObserverInformation("notices", EventSequenceId.Log, ObserverType.Reactor, ObserverRunningState.Active, 15, 16, 15);
        var failure = new FailedPartition(Guid.NewGuid(), observer.Id, "author-a", [new FailedPartitionAttempt(DateTimeOffset.UtcNow, 9, ["private payload"], "private stack", FailureKind.Timeout)]);
        Assert.Equal("notices/author-a: Timeout at 9; seek approval for scoped retry", Describe(observer, "author-a", 9, [failure]));
        Assert.Equal("Behind; compare next snapshot", Describe(observer, "author-b", 20, [failure]));
        Assert.Equal("Check downstream output", Describe(observer, "author-a", 9, [failure with { IsResolved = true }]));
    }
}
