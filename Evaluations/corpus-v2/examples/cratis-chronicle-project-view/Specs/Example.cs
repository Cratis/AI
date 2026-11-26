using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Chronicle.Observation;
using Xunit;

[EventType] public record AuthorRegistered(string Name);
[EventType] public record AuthorRemoved;

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);

[FromEvent<AuthorRegistered>]
[RemovedWith<AuthorRemoved>]
public record Author(AuthorId Id, string Name);

public class Projection
{
    [Fact]
    public async Task removes_only_the_named_author()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("corpus-project", Guid.NewGuid().ToString());
        var a = new AuthorId(Guid.NewGuid());
        var b = new AuthorId(Guid.NewGuid());
        foreach (var (key, name) in new[] { (a, "Aster"), (b, "Birch") })
        {
            var result = await store.EventLog.Append(key, new AuthorRegistered(name));
            Assert.True(result.IsSuccess);
            Assert.True((await result.WaitForCompletion()).IsSuccess);
            Assert.Equal(new Author(key, name), await store.ReadModels.GetInstanceById<Author>(key.Value));
        }
        var removal = await store.EventLog.Append(a, new AuthorRemoved());
        Assert.True(removal.IsSuccess);
        Assert.True((await removal.WaitForCompletion()).IsSuccess);
        Assert.Equal(new Author(b, "Birch"), Assert.Single(await store.ReadModels.GetInstances<Author>()));
    }
}
