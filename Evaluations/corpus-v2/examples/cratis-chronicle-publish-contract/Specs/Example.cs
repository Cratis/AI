using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Xunit;

[EventType] public record AuthorListed(string PublicName);
[EventType] public record InternalReview;
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
        const string sourceName = "corpus-publisher";
        var source = await client.GetEventStore(sourceName, ns);
        var target = await client.GetEventStore("corpus-subscriber", ns);
        await target.Subscriptions.Subscribe("author-notices", sourceName,
            builder => builder.WithEventType<AuthorListed>());
        var outbox = source.GetEventSequence(EventSequenceId.Outbox);
        var inbox = target.GetEventSequence($"{EventSequenceId.InboxPrefix}{sourceName}");
        var key = EventSourceId.New();
        Assert.True((await outbox.Append(key, new InternalReview())).IsSuccess);
        Assert.True((await outbox.Append(key, new AuthorListed("Aster"))).IsSuccess);
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        while (true)
        {
            var copies = await inbox.GetFromSequenceNumber(EventSequenceNumber.First, key);
            if (copies.Count > 0)
            {
                var copy = Assert.Single(copies);
                Assert.Equal(key, copy.Context.EventSourceId);
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
