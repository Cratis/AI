---
name: cratis-chronicle-record-event
description: Use when declaring and appending a Chronicle event directly with IEventLog, or reading a stored event's occurrence time. Not for returning an event from an Arc command (use cratis-arc-declare-command).
compatibility: .NET SDK and a disposable Chronicle kernel for append checks.
---

# Append an author registration

1. Import `AuthorId` and `AuthorName` from [Name a domain value](../cratis-fundamentals-name-value/SKILL.md). Reference `Cratis.Chronicle` in the backend. Put the registration event and its writer in `Features/Authors/Registration/`.
2. Mark the event `[EventType]`. The stored ID defaults to the type name; if you rename the type later, retain its old ID with `[EventType("AuthorRegistered")]`.
3. Inject `IEventLog` into the direct writer. Use the author's `AuthorId` as the event source ID. The event log is the default event sequence; filter it by event source to read this author's history. Return the append result to the caller.

```csharp
// Features/Authors/Registration/AuthorRegistered.cs and AuthorRegistry.cs (same namespace)
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;

using Cratis.Chronicle.Events.Constraints;
using Library.Features.Authors;

namespace Library.Features.Authors.Registration;

[EventType]
public record AuthorRegistered(
    [property: Unique(name: "UniqueAuthorName", message: "Author name must be unique")] string Name);

public class AuthorRegistry(IEventLog eventLog)
{
    public Task<AppendResult> Register(AuthorId authorId, AuthorName name) =>
        eventLog.Append(authorId, new AuthorRegistered(name.Value));
}
```

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

If the same ID may register more than once, select the intended registration by its sequence number before reading `Context.Occurred`. Do not use the time of the lookup as the time of the registration.

## Avoid

- Don't generate an ID inside the writer. Use the ID supplied for this author.
- Don't use observer completion to decide whether the append was accepted. Check `result.IsSuccess` first.
- Don't append inside an Arc command that already returns `AuthorRegistered`; that would write twice.

## When it goes off the usual path

- **The original outcome needs correcting:** append a correcting fact for that event source and preserve the original. Don't edit it in the event log.

## Related skills

- [Evolve an event](../cratis-chronicle-evolve-event/SKILL.md) before changing a stored payload's shape.
- [Protect personal data](../cratis-chronicle-protect-personal-data/SKILL.md) before recording identifying member details.

- [Return an event from an Arc command](../cratis-arc-declare-command/SKILL.md)
- [Reserve an author's name](../cratis-chronicle-constrain-append/SKILL.md)
