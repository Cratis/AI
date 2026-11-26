using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Reactors;
using Xunit;

[EventType] public record AuthorRegistered(string Name);
public interface INotices { Task Send(DeliveryId key, string name); }
public class RegistrationNotice(INotices notices) : IReactor
{
    public Task Registered(AuthorRegistered fact, ReactorDelivery delivery) =>
        notices.Send(delivery.Id, fact.Name);
}
public class Retrying : INotices
{
    readonly Dictionary<DeliveryId, string> _notices = [];
    public Task Send(DeliveryId key, string name) => _notices.TryAdd(key, name)
        ? Task.FromException(new IOException("Acknowledgement lost")) : Task.CompletedTask;

    [Fact]
    public async Task retry_uses_the_existing_receipt()
    {
        var handler = new RegistrationNotice(this);
        var delivery = new ReactorDelivery("notices", "authors", "test", EventSequenceId.Log, "author-a", EventSequenceNumber.First);
        var fact = new AuthorRegistered("Aster");
        await Assert.ThrowsAsync<IOException>(() => handler.Registered(fact, delivery));
        await handler.Registered(fact, delivery with { });
        Assert.Equal("Aster", Assert.Single(_notices).Value);
    }
}
