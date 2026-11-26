using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Xunit;

[EventType]
public record AuthorRegistered(string Name);

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);

public class AuthorRegistry(IEventLog eventLog)
{
    public Task<AppendResult> Register(AuthorId authorId, string name) =>
        eventLog.Append(authorId, new AuthorRegistered(name));
}

public class Recording
{
    [Fact]
    public async Task stores_the_payload_at_the_returned_position()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("corpus-record", Guid.NewGuid().ToString());
        IEventLog eventLog = store.EventLog;
        var authorId = new AuthorId(Guid.Parse("11111111-1111-4111-8111-111111111111"));
        var result = await new AuthorRegistry(eventLog).Register(authorId, "Aster");
        Assert.True(result.IsSuccess);
        var stored = Assert.Single(await eventLog.GetForEventSourceIdAndEventTypes(authorId, [typeof(AuthorRegistered).GetEventType()]));
        Assert.Equal(result.SequenceNumber, stored.Context.SequenceNumber);
        Assert.Equal(authorId.Value.ToString(), stored.Context.EventSourceId.Value);
        Assert.Equal(new AuthorRegistered("Aster"), stored.Content);
        Assert.NotEqual(default, stored.Context.Occurred);
    }
}
