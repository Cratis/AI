using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Xunit;

[EventType] public record InternalReview;
public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);
[EventType, Public, EventStore("library")] public record AuthorListed(string PublicName);

public static class ListingExchange
{
    public static async Task<AppendResult> Publish(IEventStore producer, AuthorId id, string name)
    {
        var review = await producer.EventLog.Append(id, new InternalReview());
        if (!review.IsSuccess) return review;
        return await producer.GetEventSequence(EventSequenceId.Outbox).Append(id, new AuthorListed(name));
    }
}
public class PublicDirectory
{
    readonly Dictionary<EventSourceId, string> _listings = [];
    public void Receive(EventSourceId id, AuthorListed listing) => _listings[id] = listing.PublicName;
    public string this[EventSourceId id] => _listings[id];
}
public class Publication
{
    [Fact]
    public async Task forwards_only_the_public_contract()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var ns = Guid.NewGuid().ToString();
        const string sourceName = "library";
        var source = await client.GetEventStore(sourceName, ns);
        var target = await client.GetEventStore("corpus-subscriber", ns);
        await target.Subscriptions.Subscribe("library-listings", "library", subscription => subscription.WithEventType<AuthorListed>());
        var inbox = target.GetEventSequence($"{EventSequenceId.InboxPrefix}{sourceName}");
        var key = new AuthorId(Guid.NewGuid());
        Assert.True((await ListingExchange.Publish(source, key, "Aster")).IsSuccess);
        Assert.IsType<InternalReview>(Assert.Single(await source.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, key)).Content);
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        while (true)
        {
            var copies = await inbox.GetFromSequenceNumber(EventSequenceNumber.First, key);
            if (copies.Count > 0)
            {
                var copy = Assert.Single(copies);
                Assert.Equal((EventSourceId)key, copy.Context.EventSourceId);
                var listing = Assert.IsType<AuthorListed>(copy.Content);
                var directory = new PublicDirectory();
                directory.Receive(copy.Context.EventSourceId, listing);
                Assert.Equal("Aster", directory[key]);
                break;
            }
            await Task.Delay(100, deadline.Token);
        }
    }
}
