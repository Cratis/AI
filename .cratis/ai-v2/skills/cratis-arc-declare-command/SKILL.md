---
name: cratis-arc-declare-command
description: Use when writing a model-bound command record or its Handle method, including a handler that returns an event. Not for dispatching it (use cratis-arc-invoke-command).
compatibility: Requires the Cratis package for Arc with Chronicle.
---

# Register an author

Put this command in `Features/Authors/Registration/RegisterAuthor.cs`. Use the existing [AuthorId](../cratis-fundamentals-name-value/SKILL.md) from `Library.Features.Authors` and [AuthorRegistered](../cratis-chronicle-record-event/SKILL.md) from the command's namespace. `Cratis` supplies the framework global usings. Without those global usings, import `Cratis.Arc.Commands.ModelBound` for `[Command]`.

```csharp
namespace Library.Features.Authors.Registration;

[Command]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}
```

Use the shared `AuthorId` record, which derives from `EventSourceId<Guid>`; don't redeclare it in the command. Arc selects the event source by property type, so the single `AuthorId` property identifies the author's history in any constructor position. In this event-sourced state change, `Handle()` decides which fact to record. Return the accepted name in the event; the Arc pipeline with Chronicle appends it once.

For a command that already uses an ordinary concept or primitive as its identity, mark that one positional member `[property: Key]` using `Cratis.Chronicle.Keys`. A property named `Id` alone does not select the event source. `EventSourceId` is a type, not an attribute.

[Test the append](../cratis-specifications-exercise-backend/SKILL.md) against the caller's author ID and submitted name.

## When it goes off the usual path

- **The decision needs existing state:** load it before `Handle` via `Provide()`. If the provider can't supply required state, return a typed failure, not `null`.

## Avoid

- Do not append in `Handle`; return the event.
- Do not replace the caller's ID with `AuthorId.New()` inside the command.

## Related skills

- [Invoke the command](../cratis-arc-invoke-command/SKILL.md)
- [Validate the command](../cratis-arc-validate-command/SKILL.md) to reject an empty name before the handler runs.
