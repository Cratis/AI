---
name: cratis-chronicle-constrain-append
description: Reserves a unique value at Chronicle append time. Use when two authors must not register the same name. Not for protecting an earlier command decision (use cratis-chronicle-protect-decision).
compatibility: .NET SDK and a disposable Chronicle kernel for append checks.
---

# Reject duplicate author names when appending a registration

1. Reference `Cratis.Chronicle` and `Cratis.Fundamentals`. Change the existing registration event's `Name` to the `AuthorName` concept below; don't declare a second `AuthorRegistered` event.
2. Put `[property: Unique]` on the record parameter, not on the record type. Give the reservation a stable name and an error message.
3. Use the same reservation name on the event that frees the author's name. If `AuthorRemoved` already exists, add `RemoveConstraint` to that event instead of adding another type.

```csharp
// Features/Authors/Registration/AuthorRegistered.cs
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Constraints;
using Cratis.Concepts;

namespace Library.Authors.Registration;

public record AuthorName(string Value) : ConceptAs<string>(Value);

[EventType]
public record AuthorRegistered(
    [property: Unique(name: "UniqueAuthorName", message: "Author name must be unique")] AuthorName Name);

[EventType, RemoveConstraint("UniqueAuthorName")]
public record AuthorRemoved;
```

## Try the same name for two author IDs

Use `AuthorId` from [Record an event](../cratis-chronicle-record-event/SKILL.md). Append `new AuthorRegistered(new AuthorName("Aster"))` for the first ID and check `result.IsSuccess`. Try it for the second ID. Expect `result.IsSuccess` to be false and `result.ConstraintViolations.Single().ConstraintName.Value` to be `"UniqueAuthorName"`. No event should be stored for the second author. Append `new AuthorRemoved()` for the first ID before trying the second registration again.

## Avoid

- Don't query for the name and then append without a constraint; two callers could pass the query together.
- Don't put `[Unique]` on the event type for a name reservation. That limits occurrences per event source.
- Don't use a different constraint name on `AuthorRemoved`; it must release the original reservation.

## Related skills

- [Record the registration](../cratis-chronicle-record-event/SKILL.md)
- [Protect a command decision](../cratis-chronicle-protect-decision/SKILL.md)
