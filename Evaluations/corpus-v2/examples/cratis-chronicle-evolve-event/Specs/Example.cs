using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Migrations;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Chronicle.ReadModels;
using Cratis.Chronicle.Testing;
using Xunit;

[EventType("corpus-author-registered")] public record Original(string Name);
[EventType("corpus-author-registered", generation: 2)] public record AuthorRegistered(string DisplayName);
[EventTypeGenerationFor<AuthorRegistered>(1)] public record AuthorRegisteredV1(string Name);
[Passive, FromEvent<AuthorRegistered>] public record CurrentRow(Guid Id, string DisplayName);
[Passive, FromEvent<AuthorRegisteredV1>] public record LegacyRow(Guid Id, string Name);
public class Rename : EventTypeMigration<AuthorRegistered, AuthorRegisteredV1>
{
    public override void Upcast(IEventMigrationBuilder<AuthorRegistered, AuthorRegisteredV1> builder) => builder.Properties(p => p.RenamedFrom(t => t.DisplayName, s => s.Name));
    public override void Downcast(IEventMigrationBuilder<AuthorRegisteredV1, AuthorRegistered> builder) => builder.Properties(p => p.RenamedFrom(t => t.Name, s => s.DisplayName));
}
public class Migration
{
    [Fact]
    public async Task reads_both_generations_after_registration()
    {
        var storeName = $"corpus-evolve-{Guid.NewGuid():N}";
        var historical = Guid.NewGuid();
        using (var legacy = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString(), new InMemoryClientArtifactsProvider { EventTypes = [typeof(Original)] }))
        {
            var store = await legacy.GetEventStore(storeName, "fixture");
            Assert.True((await store.EventLog.Append(historical, new Original("Aster Vale"))).IsSuccess);
        }
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString(), new InMemoryClientArtifactsProvider
        {
            EventTypes = [typeof(AuthorRegisteredV1), typeof(AuthorRegistered)], EventTypeMigrators = [typeof(Rename)], ModelBoundProjections = [typeof(LegacyRow), typeof(CurrentRow)]
        });
        var upgraded = await client.GetEventStore(storeName, "fixture");
        var recent = Guid.NewGuid();
        Assert.True((await upgraded.EventLog.Append(recent, new AuthorRegistered("Birch"))).IsSuccess);
        foreach (var (id, name) in new[] { (historical, "Aster Vale"), (recent, "Birch") })
        {
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            while ((await upgraded.ReadModels.GetInstanceById<CurrentRow>(id))?.DisplayName != name) await Task.Delay(100, deadline.Token);
            Assert.Equal(name, (await upgraded.ReadModels.GetInstanceById<LegacyRow>(id)).Name);
        }
    }
}
