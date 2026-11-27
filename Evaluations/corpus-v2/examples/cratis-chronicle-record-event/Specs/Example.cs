using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Xunit;

using Library.Features.Authors;

namespace Library.Features.Authors.Registration;

public class Recording
{
    [Fact]
    public async Task stores_the_payload_at_the_returned_position()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("corpus-record", Guid.NewGuid().ToString());
        IEventLog eventLog = store.EventLog;
        var authorId = new AuthorId(Guid.Parse("11111111-1111-4111-8111-111111111111"));
        var registry = new AuthorRegistry(eventLog);
        var result = await registry.Register(authorId, new AuthorName("Aster"));
        Assert.True(result.IsSuccess);
        var stored = Assert.Single(await eventLog.GetForEventSourceIdAndEventTypes(authorId, [typeof(AuthorRegistered).GetEventType()]));
        Assert.Equal(result.SequenceNumber, stored.Context.SequenceNumber);
        Assert.Equal(authorId.Value.ToString(), stored.Context.EventSourceId.Value);
        Assert.Equal(new AuthorRegistered("Aster"), stored.Content);
        Assert.NotEqual(default, stored.Context.Occurred);
        Assert.Equal<DateTimeOffset?>(stored.Context.Occurred, await registry.GetRegistrationTime(authorId));
        var unregisteredId = new AuthorId(Guid.Parse("22222222-2222-4222-8222-222222222222"));
        Assert.Null(await registry.GetRegistrationTime(unregisteredId));
    }
}
