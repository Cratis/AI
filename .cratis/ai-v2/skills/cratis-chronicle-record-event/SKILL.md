---
name: cratis-chronicle-record-event
description: Use when declaring an event and appending it to Chronicle directly with IEventLog. Not for returning an event from an Arc command (use cratis-arc-declare-command).
compatibility: .NET SDK and a disposable Chronicle kernel for append checks.
---

# Append an author registration

1. Import `AuthorId` and `AuthorName` from [Name a domain value](../cratis-fundamentals-name-value/SKILL.md). Reference `Cratis.Chronicle` in the backend. Put the registration event and its writer in `Features/Authors/Registration/`.
2. Mark the event `[EventType]`. The stored ID defaults to the type name; if you rename the type later, retain its old ID with `[EventType("AuthorRegistered")]`.
3. Inject `IEventLog` into the direct writer. Pass the same `AuthorId` for all events about that author. Return the append result to the caller.

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

## Avoid

- Don't generate an ID inside the writer. Use the ID supplied for this author.
- Don't use observer completion to decide whether the append was accepted. Check `result.IsSuccess` first.
- Don't append inside an Arc command that already returns `AuthorRegistered`; that would write twice.

## Related skills

- [Return an event from an Arc command](../cratis-arc-declare-command/SKILL.md)
- [Reserve an author's name](../cratis-chronicle-constrain-append/SKILL.md)
