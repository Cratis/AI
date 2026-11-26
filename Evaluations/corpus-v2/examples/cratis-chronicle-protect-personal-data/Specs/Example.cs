using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Compliance.GDPR;
using Xunit;

[EventType]
public record ProfileSupplied([Subject] string Author, [property: PII] string DisplayName);
public class Forgetting
{
    [Fact]
    public async Task erases_one_subject_not_the_control()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("corpus-erasure", Guid.NewGuid().ToString());
        var first = EventSourceId.New();
        var second = EventSourceId.New();
        Subject subject = Guid.NewGuid().ToString();
        Assert.True((await store.EventLog.Append(first, new ProfileSupplied(subject, "Aster"))).IsSuccess);
        Assert.True((await store.EventLog.Append(second, new ProfileSupplied(Guid.NewGuid().ToString(), "Birch"))).IsSuccess);
        async Task<ProfileSupplied> Read(EventSourceId key) => Assert.IsType<ProfileSupplied>(Assert.Single(await store.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, key)).Content);
        Assert.Equal("Aster", (await Read(first)).DisplayName);
        await store.PII.DeleteEncryptionKeyFor(subject);
        var erased = Assert.Single(await store.EventLog.GetFromSequenceNumberWithErasedProperties(EventSequenceNumber.First, first));
        Assert.Contains(erased.Context.ErasedProperties, path => path.EndsWith("displayName", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(string.Empty, Assert.IsType<ProfileSupplied>(erased.Content).DisplayName);
        Assert.Equal("Birch", (await Read(second)).DisplayName);
    }
}
