using Cratis.Chronicle;
using Cratis.Chronicle.Auditing;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Chronicle.ReadModels;
using Cratis.Chronicle.Transactions;
using Cratis.Execution;
using Xunit;

[EventType] public record AuthorRegistered(string Name);
[Passive, FromEvent<AuthorRegistered>] public record Author(Guid Id, string Name);
public class GuardedCreation
{
    [Fact]
    public async Task rejects_a_decision_based_on_absence()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("corpus-guard", Guid.NewGuid().ToString());
        EventSourceId source = Guid.NewGuid();
        UnitOfWork NewUnit() => new(CorrelationId.New(), _ => { }, store);
        var first = NewUnit();
        var owner = first.ClaimDecisionReadCommitOwnership();
        using (first.EnforceReadProtection())
        {
            Assert.False((await store.GetDecisionReads().GetFor<Author>(first, source)).Exists);
            Task competitor;
            using (ExecutionContext.SuppressFlow()) competitor = Task.Run(async () => Assert.True((await store.EventLog.Append(source, new AuthorRegistered("Birch"))).IsSuccess));
            await competitor;
            first.AddEvent(EventSequenceId.Log, source, new AuthorRegistered("Aster"), Causation.Unknown());
            await first.CommitAsOwner(owner);
        }
        Assert.False(first.IsSuccess);
        Assert.Contains(first.GetConcurrencyViolations(), violation => violation.EventSourceId == source);
        var fresh = NewUnit();
        using (fresh.EnforceReadProtection()) Assert.True((await store.GetDecisionReads().GetFor<Author>(fresh, source)).Exists);
        Assert.Equal(new AuthorRegistered("Birch"), Assert.Single(await store.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, source)).Content);
    }
}
