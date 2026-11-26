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

`AuthorId` derives from `EventSourceId<Guid>`. Arc recognizes this property's type, not its constructor position, when selecting the author's history. Return the accepted name as the fact; the pipeline appends it once.

In an async xUnit test referencing `Cratis.Arc.Chronicle.Testing`, import `Xunit`, `Library.Features.Authors`, `Library.Features.Authors.Registration`, `Cratis.Arc.Testing.Commands` and `Cratis.Arc.Chronicle.Testing.Commands`. If the `catalog-editor` role requirement is installed, add `scenario.WithClaims(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "catalog-editor"));` immediately after creating the scenario. Check the complete append sequence and the selected author ID:

```csharp
await using var scenario = new CommandScenario<RegisterAuthor>();
var id = AuthorId.New();
var result = await scenario.Execute(new RegisterAuthor(id, "Aster"));
Assert.True(result.IsSuccess);
await scenario.ShouldHaveAppendedEventsInOrder(new AuthorRegistered("Aster"));
await scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(id, e => e.Name == "Aster");
```

## Avoid

- Do not append in `Handle`; return the event.
- Do not use a plain `Guid` for this event-source property.
- Do not replace the caller's ID with `AuthorId.New()` inside the command.

## Related skills

- [Invoke the command](../cratis-arc-invoke-command/SKILL.md)
- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md)
