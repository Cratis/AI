using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Library.Features.Authors;

namespace Library.Features.Authors.Registration;

public class AuthorRegistry(IEventLog eventLog)
{
    public Task<AppendResult> Register(AuthorId authorId, AuthorName name) =>
        eventLog.Append(authorId, new AuthorRegistered(name.Value));

    public async Task<DateTimeOffset?> GetRegistrationTime(AuthorId authorId)
    {
        var registrations = await eventLog.GetForEventSourceIdAndEventTypes(
            authorId, [typeof(AuthorRegistered).GetEventType()]);
        var stored = registrations.SingleOrDefault();
        return stored?.Context.Occurred;
    }
}
