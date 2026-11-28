# Reject duplicate author names when appending a registration

1. In `Features/Authors/Registration/AuthorRegistered.cs`, extend the event from [Record an event](../../cratis-chronicle-record-event/SKILL.md) to declare the unique constraint on its **string** parameter. Reference `Cratis.Chronicle` and import `Cratis.Chronicle.Events.Constraints`:

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

For one registration event and a fixed refusal message, keep the attribute: its explicit `name` already gives callers a stable identifier. If the refusal must follow the current culture, use the `IConstraint` builder below even for one event. Omit the rename clause, keep `WithName("UniqueAuthorName")`, and add `.WithMessage(_ => Messages.AuthorNameMustBeUnique)` to the unique rule, where `Messages.AuthorNameMustBeUnique` reads your localized resource when the message is requested.

## Try the same name for two author IDs

One-off wiring check, not a spec of Chronicle's constraint mechanism. For an uncovered application refusal, use the existing backend fixture (the `cratis-specifications-exercise-backend` skill, when installed).

Start in a disposable namespace with no claim on the name. Use two different `AuthorId` values and `var name = new AuthorName("Aster");` from Name a domain value (the `cratis-fundamentals-name-value` skill, when installed). Append `new AuthorRegistered(name.Value)` for the first ID and check `result.IsSuccess`. Try the same fact for the second ID: `result.IsSuccess` must be false and `result.ConstraintViolations.Single().ConstraintName.Value` must be `"UniqueAuthorName"`. No event should be stored for the second author. Append `new AuthorRemoved()` for the first ID and check acceptance. Retry the second registration and expect success.

## When it goes off the usual path

- **Registration and a later rename must claim names in the same reservation:** replace the `Unique` property attribute and `RemoveConstraint` release with one declarative rule. In a class implementing `IConstraint` from `Cratis.Chronicle.Events.Constraints`, add `public void Define(IConstraintBuilder builder) => builder.Unique(u => u.WithName("UniqueAuthorName").On<AuthorRegistered>(e => e.Name).On<AuthorRenamed>(e => e.Name).RemovedWith<AuthorRemoved>());`. Here the additional fact is `[EventType] public record AuthorRenamed(string Name);`. Check that a rename to a different author's name is refused and that removal releases the claim.
- **The same source must not record an event type twice:** put `[Unique]` directly on that event record, not on a property. Append two occurrences for one source and check the second is refused. Keep the property rule if names must also be unique across sources.

By default, `UniqueConstraintMode.PerEventSource` retains the source's current claim. Choose `Mode = UniqueConstraintMode.PerValue` on the property constraint when earlier values must stay reserved after that source claims another one. The append applies the constraint within one store, namespace and event sequence. Don't rely on query-before-append; two writers can both pass that check.

## Related skills

- [Record the registration](../../cratis-chronicle-record-event/SKILL.md)
- [Protect a command decision](../../cratis-chronicle-protect-decision/SKILL.md)

## Select scope and retention separately

A class-level unique event type admits that event once per source; a property-level unique claim can reject another source. `PerEventSource` releases the old value when its owner replaces it; `PerValue` retains earlier claims. For a multi-type or composite claim use the constraint builder and `.IgnoreCasing()` when needed. A property path identifies the field; it is not a place to call `ToLower()`.

`[ClosesStream]` makes the closing append and its closure one operation. Choose the dimensions explicitly. In a manual `ClosedStreamScope` an omitted dimension is a wildcard: specifying only a source includes **all** its streams. Inspect the exact store, namespace and scope before any manual repair. Do not confuse an event-owned closure with an operator-owned closure.
