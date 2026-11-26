using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Chronicle.ReadModels;
using Xunit;

[EventType] public record AuthorRegistered(string Name);
[EventType] public record AuthorRemoved;

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);

[Passive]
[FromEvent<AuthorRegistered>]
[RemovedWith<AuthorRemoved>]
public record Author(AuthorId Id, string Name);

public class Projection
{
    [Fact]
    public async Task removes_only_the_addressed_row()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("corpus-project", Guid.NewGuid().ToString());
        var a = Guid.Parse("11111111-1111-4111-8111-111111111111");
        var b = Guid.NewGuid();
        foreach (var key in new[] { a, b })
        {
            Assert.True((await store.EventLog.Append(key, new AuthorRegistered("Aster"))).IsSuccess);
            Assert.Equal(new Author(new AuthorId(key), "Aster"), await store.ReadModels.GetInstanceById<Author>(key));
        }
        Assert.True((await store.EventLog.Append(a, new AuthorRemoved())).IsSuccess);
        Assert.Null(await store.ReadModels.GetInstanceById<Author>(a));
        Assert.Equal(new Author(new AuthorId(b), "Aster"), await store.ReadModels.GetInstanceById<Author>(b));
    }
}
