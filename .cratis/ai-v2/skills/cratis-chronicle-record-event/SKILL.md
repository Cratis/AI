---
name: cratis-chronicle-record-event
description: Use when declaring and appending a Chronicle event directly with IEventLog, or reading a stored event's occurrence time. Not for returning an event from an Arc command (use cratis-arc-declare-command).
compatibility: .NET SDK and a disposable Chronicle kernel for append checks.
---

# Append an author registration

1. Import `AuthorId` and `AuthorName` from [Name a domain value](../cratis-fundamentals-name-value/SKILL.md). Reference `Cratis.Chronicle` in the backend. Put the registration event and its writer in `Features/Authors/Registration/`.
2. Mark the event `[EventType]`. The stored ID defaults to the type name; if you rename the type later, retain its old ID with `[EventType("AuthorRegistered")]`.
3. Inside Arc, [return the fact from the handler](../cratis-arc-declare-command/SKILL.md). Choose a guarded `IEventLog` append when the writer is standalone. Use the caller's `AuthorId` as the event source ID and return the append result.

```csharp
// Features/Authors/Registration/AuthorRegistered.cs and AuthorRegistry.cs (same namespace)
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.EventSequences.Concurrency;
using Cratis.Chronicle.Events.Constraints;
using Library.Features.Authors;

namespace Library.Features.Authors.Registration;

[EventType]
public record AuthorRegistered(
    [property: Unique(name: "UniqueAuthorName", message: "Author name must be unique")] string Name);

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

The standalone writer is create-only: a freshly generated ID is not proof this history is unused. Its append condition checks for any prior event at that ID; `UniqueAuthorName` reserves the name across histories. After one accepted append, try a different unused name for the same ID and require a concurrency violation and no second event.

## Read back the accepted registration

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

- [Evolve an event](../cratis-chronicle-evolve-event/SKILL.md) before changing a stored payload's shape.
- [Protect personal data](../cratis-chronicle-protect-personal-data/SKILL.md) before recording identifying member details.

- [Return an event from an Arc command](../cratis-arc-declare-command/SKILL.md)
- [Reserve an author's name](../cratis-chronicle-constrain-append/SKILL.md)
