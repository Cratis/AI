using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Migrations;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Chronicle.ReadModels;
using Cratis.Chronicle.Testing;
using Xunit;

[EventType("AuthorRegistered")] public record Original(string Name);
[EventType(generation: 2)] public record AuthorRegistered(string DisplayName);
[EventTypeGenerationFor<AuthorRegistered>(1)] public record AuthorRegisteredV1(string Name);
public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);
[FromEvent<AuthorRegistered>] public record CurrentAuthor(AuthorId Id, string DisplayName);
[FromEvent<AuthorRegisteredV1>] public record PreviousAuthor(AuthorId Id, string Name);
public class AuthorRegisteredMigration : EventTypeMigration<AuthorRegistered, AuthorRegisteredV1>
{
    public override void Upcast(IEventMigrationBuilder<AuthorRegistered, AuthorRegisteredV1> builder) =>
        builder.Properties(p => p.RenamedFrom(t => t.DisplayName, s => s.Name));
    public override void Downcast(IEventMigrationBuilder<AuthorRegisteredV1, AuthorRegistered> builder) =>
        builder.Properties(p => p.RenamedFrom(t => t.Name, s => s.DisplayName));
}
public class Migration
{
    [Fact]
    public async Task reads_both_generations_after_registration()
    {
        var storeName = $"corpus-evolve-{Guid.NewGuid():N}";
        var historical = new AuthorId(Guid.NewGuid());
        using (var legacy = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString(), new InMemoryClientArtifactsProvider { EventTypes = [typeof(Original)] }))
        {
            var store = await legacy.GetEventStore(storeName, "fixture");
            Assert.True((await store.EventLog.Append(historical, new Original("Aster Vale"))).IsSuccess);
        }
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString(), new InMemoryClientArtifactsProvider
        {
            EventTypes = [typeof(AuthorRegisteredV1), typeof(AuthorRegistered)], EventTypeMigrators = [typeof(AuthorRegisteredMigration)], ModelBoundProjections = [typeof(PreviousAuthor), typeof(CurrentAuthor)]
        });
        var upgraded = await client.GetEventStore(storeName, "fixture");
        var recent = new AuthorId(Guid.NewGuid());
        Assert.True((await upgraded.EventLog.Append(recent, new AuthorRegistered("Birch"))).IsSuccess);
        foreach (var (id, name) in new[] { (historical, "Aster Vale"), (recent, "Birch") })
        {
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            while ((await upgraded.ReadModels.GetInstanceById<CurrentAuthor>(id.Value))?.DisplayName != name ||
                   (await upgraded.ReadModels.GetInstanceById<PreviousAuthor>(id.Value))?.Name != name)
                await Task.Delay(100, deadline.Token);
        }
    }
}
