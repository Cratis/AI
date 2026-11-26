---
name: cratis-chronicle-constrain-append
description: Use when a value must be unique at Chronicle append time, such as when two authors must not register the same name. Not for protecting an earlier command decision (use cratis-chronicle-protect-decision).
compatibility: .NET SDK and a disposable Chronicle kernel for append checks.
---

# Reject duplicate author names when appending a registration

1. In `Features/Authors/Registration/AuthorRegistered.cs`, the event from [Record an event](../cratis-chronicle-record-event/SKILL.md) declares the unique constraint on its **string** parameter. Reference `Cratis.Chronicle` and import `Cratis.Chronicle.Events.Constraints`:

```csharp
[property: Unique(name: "UniqueAuthorName", message: "Author name must be unique")] string Name
```

2. Keep callers' wire shape unchanged: `new AuthorRegistered("Aster")`. A caller holding an `AuthorName` concept passes `new AuthorRegistered(name.Value)`.
3. Declare the removal event once, in its own feature. Name the reservation it releases:

```csharp
// Features/Authors/Removal/AuthorRemoved.cs
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Constraints;

namespace Library.Features.Authors.Removal;

[EventType, RemoveConstraint("UniqueAuthorName")]
public record AuthorRemoved;
```

## Try the same name for two author IDs

Use two different `AuthorId` values from [Name a domain value](../cratis-fundamentals-name-value/SKILL.md). Append `new AuthorRegistered("Aster")` for the first ID and check `result.IsSuccess`. Try it for the second ID: `result.IsSuccess` must be false and `result.ConstraintViolations.Single().ConstraintName.Value` must be `"UniqueAuthorName"`. No event should be stored for the second author. Append `new AuthorRemoved()` for the first ID and check acceptance. Retry the second registration and expect success.

## Avoid

- Don't query for the name and then append without a constraint; two callers could pass the query together.
- Don't put `[Unique]` on the event type for a name reservation. That limits occurrences per event source.
- Don't use a different constraint name on `AuthorRemoved`; it must release the original reservation.

## Related skills

- [Record the registration](../cratis-chronicle-record-event/SKILL.md)
- [Protect a command decision](../cratis-chronicle-protect-decision/SKILL.md)
