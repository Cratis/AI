---
name: cratis-arc-declare-command
description: Use when writing a model-bound command record or its Handle method, including a handler that returns an event. Not for dispatching it (use cratis-arc-invoke-command).
compatibility: Requires the Cratis package for Arc with Chronicle.
---

# Register an author

Put this command in `Features/Authors/Registration/RegisterAuthor.cs`. Use the existing [AuthorId](../cratis-fundamentals-name-value/SKILL.md) from `Library.Features.Authors` and [AuthorRegistered](../cratis-chronicle-record-event/SKILL.md) from the command's namespace. `Cratis` supplies the framework global usings.

```csharp
namespace Library.Features.Authors.Registration;

[Command]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}
```

Use the shared `AuthorId` record, which derives from `EventSourceId<Guid>`; don't redeclare it in the command. Arc selects the event source by property type, so the single `AuthorId` property identifies the author's history in any constructor position. Return the accepted name as the fact; the pipeline appends it once.

[Test the append](../cratis-specifications-exercise-backend/SKILL.md) against the caller's author ID and submitted name.

## Avoid

- Do not append in `Handle`; return the event.
- Do not use a plain `Guid` for this event-source property.
- Do not replace the caller's ID with `AuthorId.New()` inside the command.

## Related skills

- [Invoke the command](../cratis-arc-invoke-command/SKILL.md)
- [Validate the command](../cratis-arc-validate-command/SKILL.md) to reject an empty name before the handler runs.
