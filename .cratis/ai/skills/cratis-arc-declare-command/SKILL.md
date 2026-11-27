---
name: cratis-arc-declare-command
description: Use when writing a model-bound command record or its Handle method, including a handler that returns an event. Not for dispatching it (use cratis-arc-invoke-command).
compatibility: Requires the Cratis package for Arc with Chronicle.
---

# Register an author

Keep the ID in the request when the caller already owns it. Put this command in `Features/Authors/Registration/RegisterAuthor.cs`. Use the existing [AuthorId](../cratis-fundamentals-name-value/SKILL.md) from `Library.Features.Authors` and [AuthorRegistered](../cratis-chronicle-record-event/SKILL.md) from the command's namespace. `Cratis` supplies the framework global usings. Without those global usings, import `Cratis.Arc.Commands.ModelBound` for `[Command]`.

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

**A command needs an existing author:** in a command with an `AuthorId Id`, use a provider like this and accept `AuthorName` as a `Handle` parameter. Import `Cratis.Monads`, `Cratis.Arc.Validation`, `Library.Features.Authors.Listing` and `MongoDB.Driver`.

```csharp
public Result<AuthorName, ValidationResult> Provide(IMongoCollection<Author> authors) =>
    authors.FindById(Id) is { } author ? new AuthorName(author.Name) : ValidationResult.Error("Author not found");
```

Arc drops `null` from the provided values; it is not a validation result. If a decision requires current committed facts, [protect the decision](../cratis-chronicle-protect-decision/SKILL.md) rather than relying on a projected row.

## When the server allocates the ID

Choose this when the Library, not the caller, allocates the ID. In `Features/Authors/AuthorId.cs`, add `IGeneratable<AuthorId>` (from `Cratis.Concepts`) to the existing declaration: `public record AuthorId(Guid Value) : EventSourceId<Guid>(Value), IGeneratable<AuthorId>`. Keep its existing `New()` factory and replace the command with:

```csharp
namespace Library.Features.Authors.Registration;

[Command]
public record RegisterAuthor(string Name)
{
    public (AuthorId, EventForEventSourceId) Handle([GeneratedValue("authorId")] AuthorId authorId) =>
        (authorId, new EventForEventSourceId(authorId, new AuthorRegistered(Name)));
}
```

Arc calls `AuthorId.New()` for the generated parameter. The wrapper addresses the event to that ID; the first tuple item returns it to the caller. If the caller does not need the ID, return only the wrapper. Check `IsSuccess` before using the response. In the [backend spec](../cratis-specifications-exercise-backend/SKILL.md), import `Cratis.Arc.Testing.Commands` and insert `scenario.PinGeneratedValue("authorId", id);` before execution. Supply the fixed `AuthorId id` used by the append assertion.

## Avoid

- In the Arc + Chronicle return-event path, let the pipeline append the returned event; do not also append in `Handle`. An Arc-only command does not have to return an event.
- Do not replace a caller-owned ID with `AuthorId.New()`.

## Related skills

- [Invoke the command](../cratis-arc-invoke-command/SKILL.md)
- [Validate the command](../cratis-arc-validate-command/SKILL.md) to reject an empty name before the handler runs.
