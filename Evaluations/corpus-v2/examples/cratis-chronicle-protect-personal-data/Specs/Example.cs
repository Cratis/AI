using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle;
using Cratis.Chronicle.Compliance.GDPR;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Observation;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Concepts;
using Xunit;

namespace Library.Members.Profiles;

public record MemberId(Guid Value) : EventSourceId<Guid>(Value);
[PII("Member name for identification and correspondence")]
public record MemberName(string Value) : ConceptAs<string>(Value);
[EventType]
public record MemberRegistered(MemberName Name, [PII("Email for member correspondence")] string Email);
[ReadModel, FromEvent<MemberRegistered>]
public record MemberProfile(MemberId Id, MemberName Name, [PII("Email for member correspondence")] string Email);

public class MemberErasure
{
    [Fact]
    public async Task erases_the_requested_members_email_but_not_the_other_members_email()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("library", Guid.NewGuid().ToString());
        var first = new MemberId(Guid.NewGuid());
        var second = new MemberId(Guid.NewGuid());
        foreach (var (id, name, email) in new[] { (first, "Aster", "aster@example.org"), (second, "Birch", "birch@example.org") })
        {
            var registration = await store.EventLog.Append(id, new MemberRegistered(new MemberName(name), email));
            Assert.True(registration.IsSuccess);
            Assert.True((await registration.WaitForCompletion()).IsSuccess);
            var profile = await store.ReadModels.GetInstanceById<MemberProfile>(id.Value);
            Assert.NotNull(profile);
            Assert.Equal(email, profile.Email);
        }
        await store.PII.DeleteEncryptionKeyFor(first.Value.ToString());
        var erased = Assert.Single(await store.EventLog.GetFromSequenceNumberWithErasedProperties(EventSequenceNumber.First, first));
        Assert.Contains(erased.Context.ErasedProperties, path => path.EndsWith("email", StringComparison.OrdinalIgnoreCase));
        Assert.NotEqual("aster@example.org", Assert.IsType<MemberRegistered>(erased.Content).Email);
        var control = await store.ReadModels.GetInstanceById<MemberProfile>(second.Value);
        Assert.NotNull(control);
        Assert.Equal("birch@example.org", control.Email);
    }
}
