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

2. `AuthorRegistered` stores the Library name as a `string`. At the append boundary, unwrap the in-process `AuthorName` with `new AuthorRegistered(name.Value)`.
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

Use two different `AuthorId` values and `var name = new AuthorName("Aster");` from [Name a domain value](../cratis-fundamentals-name-value/SKILL.md). Append `new AuthorRegistered(name.Value)` for the first ID and check `result.IsSuccess`. Try the same fact for the second ID: `result.IsSuccess` must be false and `result.ConstraintViolations.Single().ConstraintName.Value` must be `"UniqueAuthorName"`. No event should be stored for the second author. Append `new AuthorRemoved()` for the first ID and check acceptance. Retry the second registration and expect success.

## When it goes off the usual path

- **Several facts or fields define one reservation:** choose a named declarative `IConstraint` when one annotated property cannot express the rule. Replace the attribute rule with one `Unique` definition, `.On` for each contributing event (with property selectors in the same order for a composite), and `.RemovedWith<AuthorRemoved>()`. Test collisions across the contributing facts and reuse after release.
- **The same source must not record the same event type twice:** that is an occurrence limit, not a name reservation across sources. An event-type uniqueness rule does not prevent two authors from taking Aster.

Don't enforce uniqueness with a query or validator alone; two callers can both pass the check before either appends. The claim and its release must use the same constraint.

## Related skills

- [Record the registration](../cratis-chronicle-record-event/SKILL.md)
- [Protect a command decision](../cratis-chronicle-protect-decision/SKILL.md)
