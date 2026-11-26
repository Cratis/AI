using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Xunit;

[EventType]
public record AuthorRegistered(string Name);

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);

public class Recording
{
    [Fact]
    public async Task stores_the_payload_at_the_returned_position()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("corpus-record", Guid.NewGuid().ToString());
        IEventLog eventLog = store.EventLog;
        var authorId = new AuthorId(Guid.Parse("11111111-1111-4111-8111-111111111111"));
        var result = await eventLog.Append(authorId, new AuthorRegistered("Aster"));
        Assert.True(result.IsSuccess);
        var fact = Assert.Single(await eventLog.GetFromSequenceNumber(EventSequenceNumber.First, authorId));
        Assert.Equal(result.SequenceNumber, fact.Context.SequenceNumber);
        Assert.Equal(authorId.Value.ToString(), fact.Context.EventSourceId.Value);
        Assert.Equal(new AuthorRegistered("Aster"), fact.Content);
    }
}
