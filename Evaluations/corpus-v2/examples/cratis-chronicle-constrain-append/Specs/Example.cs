using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Constraints;
using Cratis.Concepts;
using Xunit;

using Library.Features.Authors;
using Library.Features.Authors.Removal;

namespace Library.Features.Authors.Registration;

public class Reservation
{
    [Fact]
    public async Task refuses_the_same_name_for_a_different_author()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("corpus-unique", Guid.NewGuid().ToString());
        var first = new AuthorId(Guid.NewGuid());
        var other = new AuthorId(Guid.NewGuid());
        var registration = new AuthorRegistered("Aster");
        Assert.True((await store.EventLog.Append(first, registration)).IsSuccess);
        var refused = await store.EventLog.Append(other, registration);
        Assert.False(refused.IsSuccess);
        Assert.Equal("UniqueAuthorName", Assert.Single(refused.ConstraintViolations).ConstraintName.Value);
        Assert.Empty(await store.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, other));
        Assert.True((await store.EventLog.Append(first, new AuthorRemoved())).IsSuccess);
        Assert.True((await store.EventLog.Append(other, registration)).IsSuccess);
    }
}
