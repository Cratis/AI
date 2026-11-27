using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Xunit;
using Library.Contracts;
using Library.Features.Authors;

namespace Library.Features.Authors.Publication;

public static class ListingExchange
{
    public static async Task<AppendResult> Publish(IEventStore producer, AuthorId id, string name)
    {
        var review = await producer.EventLog.Append(id, new AuthorReviewed());
        if (!review.IsSuccess) return review;
        return await producer.GetEventSequence(EventSequenceId.Outbox).Append(id, new AuthorListed(name));
    }
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
        var target = await client.GetEventStore("directory", ns);
        await target.Subscriptions.Subscribe("library-listings", "library", subscription => subscription.WithEventType<AuthorListed>());
        var inbox = target.GetEventSequence($"{EventSequenceId.InboxPrefix}{sourceName}");
        var key = new AuthorId(Guid.NewGuid());
        Assert.True((await ListingExchange.Publish(source, key, "Aster")).IsSuccess);
        Assert.IsType<AuthorReviewed>(Assert.Single(await source.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, key)).Content);
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        while (true)
        {
            var copies = await inbox.GetFromSequenceNumber(EventSequenceNumber.First, key);
            if (copies.Count > 0)
            {
                var copy = Assert.Single(copies);
                Assert.Equal((EventSourceId)key, copy.Context.EventSourceId);
                var listing = Assert.IsType<AuthorListed>(copy.Content);
                Assert.Equal("Aster", listing.PublicName);
                break;
            }
            await Task.Delay(100, deadline.Token);
        }
    }
}
