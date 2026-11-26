using Library.Features.Authors.Registration;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Reactors;
using Xunit;

namespace Library.Features.Authors.Directory;

public interface IAuthorDirectory
{
    Task Announce(DeliveryId key, string name);
}

public class RegistrationNotice(IAuthorDirectory directory) : IReactor
{
    public Task Registered(AuthorRegistered @event, ReactorDelivery delivery) =>
        directory.Announce(delivery.Id, @event.Name);
}

public class DirectoryDelivery : IAuthorDirectory
{
    readonly Dictionary<DeliveryId, string> _notices = [];
    public Task Announce(DeliveryId key, string name) => _notices.TryAdd(key, name)
        ? Task.FromException(new IOException("Acknowledgement lost")) : Task.CompletedTask;

    [Fact]
    public async Task retry_reuses_the_delivery_id()
    {
        var notice = new RegistrationNotice(this);
        var delivery = new ReactorDelivery("directory", "library", "test", EventSequenceId.Log, "author-a", EventSequenceNumber.First);
        var registration = new AuthorRegistered("Aster");
        await Assert.ThrowsAsync<IOException>(() => notice.Registered(registration, delivery));
        await notice.Registered(registration, delivery);
        var stored = Assert.Single(_notices);
        Assert.Equal(delivery.Id, stored.Key);
        Assert.Equal("Aster", stored.Value);
    }
}
