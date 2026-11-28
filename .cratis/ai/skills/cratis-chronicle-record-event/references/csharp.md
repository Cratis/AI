# Append an author registration

Declare the fact in the registration feature. This is all the event declaration needs:

```csharp
using Cratis.Chronicle.Events;

namespace Library.Features.Authors.Registration;

[EventType] public record AuthorRegistered(string Name);
```

1. For a writer, import `AuthorId` and `AuthorName` from Name a domain value (the `cratis-fundamentals-name-value` skill, when installed). Reference `Cratis.Chronicle` in the backend. Keep the registration code in `Features/Authors/Registration/`.
2. Mark the event `[EventType]`. The event-type ID is a plain string naming the schema, not the author. It defaults to the type name; if you rename the type later, retain its old ID with `[EventType("AuthorRegistered")]`.
3. Inside Arc, return the fact from the handler (the `cratis-arc-declare-command` skill, when installed). Choose a guarded `IEventLog` append when the writer is standalone. Use the caller's `AuthorId` as the event source ID and return the append result.

**Standalone writer only:**

```csharp
// Features/Authors/Registration/AuthorRegistry.cs
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.EventSequences.Concurrency;
using Library.Features.Authors;

namespace Library.Features.Authors.Registration;

public class AuthorRegistry(IEventLog eventLog)
{
    public Task<AppendResult> Register(AuthorId authorId, AuthorName name)
    {
        var unused = new ConcurrencyScopeBuilder()
            .ExpectingNoMatchingEvent()
            .WithEventSourceId(authorId)
            .Build();
        return eventLog.Append(authorId, new AuthorRegistered(name.Value), concurrencyScope: unused);
    }
}
```

The standalone writer is create-only: a freshly generated ID is not proof this history is unused. Its append condition checks for any prior event at that ID. If names must also be unique across authors, [add that constraint separately](../../cratis-chronicle-constrain-append/SKILL.md).

## Read back the accepted registration

One-off wiring check in a disposable namespace, not a committed spec of append or readback. For an uncovered command outcome, use the backend scenario (the `cratis-specifications-exercise-backend` skill, when installed).

In a caller with the library's `IEventLog`, take the result from `var result = await new AuthorRegistry(eventLog).Register(authorId, new AuthorName("Aster"));`. Check `result.IsSuccess` before reporting success. On refusal inspect `result.ConstraintViolations`, `result.ConcurrencyViolation` and `result.Errors`. For an accepted registration, read only that author's registrations and match the returned position:

```csharp
var registrations = await eventLog.GetForEventSourceIdAndEventTypes(
    authorId, [typeof(AuthorRegistered).GetEventType()]);
var stored = registrations.Single(e => e.Context.SequenceNumber == result.SequenceNumber);
var name = ((AuthorRegistered)stored.Content).Name;
var registeredAt = stored.Context.Occurred;
```

## Read when an existing author registered

For a read-only lookup by `authorId`, query `IEventLog` for that author and the `AuthorRegistered` event type. Do not call `Register` to obtain a sequence number. If the slice allows one registration per author ID, add this method to `AuthorRegistry`. It returns the stored occurrence time or no timestamp when the author has not registered:

```csharp
public async Task<DateTimeOffset?> GetRegistrationTime(AuthorId authorId)
{
    var registrations = await eventLog.GetForEventSourceIdAndEventTypes(
        authorId, [typeof(AuthorRegistered).GetEventType()]);
    var stored = registrations.SingleOrDefault();
    return stored?.Context.Occurred;
}
```

Use the stored occurrence time, not the lookup time. If another writer permits multiple registrations per source, select the intended registration by sequence number instead of taking the single result.

## When it goes off the usual path

- **The create-only append was refused:** inspect `result.ConcurrencyViolation` and read `await eventLog.GetFromSequenceNumber(EventSequenceNumber.First, authorId)` before deciding whether to report an existing author or try again.
- **The original outcome needs correcting:** append a correcting fact for that event source and preserve the original. Don't edit it in the event log.

## Related skills

- [Evolve an event](../../cratis-chronicle-evolve-event/SKILL.md) before changing a stored payload's shape.
- [Protect personal data](../../cratis-chronicle-protect-personal-data/SKILL.md) before recording identifying member details.

- Return an event from an Arc command (the `cratis-arc-declare-command` skill, when installed)
- [Reserve an author's name](../../cratis-chronicle-constrain-append/SKILL.md)

## Decide whether another append is safe

Distinguish a confirmed refusal from `AppendOutcomeUnknown`: the latter may already have committed. If using keyed retry, preserve the key, route and prepared content. Never retry unkeyed because the key was refused. `ConstraintIndexUnavailable` wrote nothing; wait for repair and retry that attempt unchanged. `Prepare` and `VerifyContent` compare content at a known position, not whether a logical request executed exactly once. `Unavailable` is inconclusive. Named tags are metadata, not payload fields; authorize metadata reads even if they exclude content.

When returning HTTP success depends on commit, complete the owning unit before sending the response. A batch is not a general ambient transaction; middleware completion after the response cannot turn a failure into an HTTP refusal. An accepted append also does not prove observer completion. When the caller needs it, inspect `WaitForCompletion` for timeout, failed partitions and outstanding observers before reporting completion.
