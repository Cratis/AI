using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Constraints;
using Cratis.Chronicle.EventSequences.Concurrency;
using Xunit;

[EventType]
[Unique(name: "one-registration", message: "Author already registered.")]
public record AuthorRegistered(string Name);

public class RegistrationRace
{
    [Fact]
    public async Task one_source_can_register_once()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("corpus-constrain", Guid.NewGuid().ToString());
        var key = EventSourceId.New();
        var fact = new AuthorRegistered("Aster");
        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => store.EventLog.Append(key, fact, concurrencyScope: ConcurrencyScope.None)));
        Assert.Single(results, r => r.IsSuccess);
        var loser = Assert.Single(results, r => !r.IsSuccess);
        Assert.Equal("one-registration", Assert.Single(loser.ConstraintViolations).ConstraintName.Value);
        Assert.Single(await store.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, key));
        Assert.True((await store.EventLog.Append(EventSourceId.New(), fact)).IsSuccess);
    }
}
