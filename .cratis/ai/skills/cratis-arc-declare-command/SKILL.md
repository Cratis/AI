---
name: cratis-arc-declare-command
description: Use when a developer needs a model-bound command, a Handle method that returns an event, or a keyed read model for a decision. Not for dispatching it (use cratis-arc-invoke-command).
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

**Two candidate IDs:** if `BookId` and `BorrowerId` both derive from `EventSourceId<Guid>`, don't let property order decide where `BookLent` lands. For book-owned history, use `Cratis.Chronicle.Events`:

```csharp
[Command]
public record LendBook(BookId BookId, BorrowerId BorrowerId) : ICanProvideEventSourceId
{
    public EventSourceId GetEventSourceId() => BookId;
    public BookLent Handle() => new(BorrowerId);
}
```

In the [command scenario](../cratis-specifications-exercise-backend/SKILL.md), use different IDs and assert the single append is to the book, not the borrower. This tests ownership, not the handler's field copy.

## When it goes off the usual path

Refuse with a message → request the decision model in the validator. Need the state to build the event → take it as a `Handle` parameter. Both are protected by default.

Use a validator constructor parameter for the refusal. `[LookUpBy]` chooses the model to read, not where to append. For example, on a `CreditAuthor` command whose source is the book and whose `AuthorId` identifies a separately projected author, use:

```csharp
public AuthorCredited Handle([LookUpBy(nameof(CreditAuthor.AuthorId))] Author author) =>
    new(AuthorId, author.Name);
```

`LookUpBy` is in `Cratis.Arc.Commands`. Finding the author is not authorization to change the book. Check that separately. For a caller-derived key use `[LookUpBy<CallerSubject>]` when the model is keyed by the authenticated subject. For a non-key search, prefer a small projection keyed by the value the command carries. A per-stream model must match the command's own append route; it cannot be redirected with `LookUpBy`.

Don't query MongoDB or `IReadModels` inside `Provide` to bypass injection. A raw observation is not a protected decision. If no injected model can express the read, state why it is advisory and what independently guards the append. `[Unprotected("reason")]` on a method covers reads in its body, not injected parameters. See [Protect a decision](../cratis-chronicle-protect-decision/SKILL.md) before relying on concurrent state.

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

- [Deliver a lending slice](../cratis-platform-deliver-slice/SKILL.md): validate input, protect availability if lending depends on it, project `BookLent` unless already mapped, expose the live query, generate both proxies, then bind the page. As a one-off check, accept a loan and see it once without refreshing; refuse another and check nothing changed.
- [Invoke the command](../cratis-arc-invoke-command/SKILL.md)
- [Validate the command](../cratis-arc-validate-command/SKILL.md) to reject an empty name before the handler runs.
