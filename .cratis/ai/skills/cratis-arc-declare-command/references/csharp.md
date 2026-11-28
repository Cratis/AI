# C#: declare a model-bound Arc command

## Contents

- Read state to make a decision
- When the server allocates the ID
- What `Handle` may return
- Which event source the command targets
- `Provide`, generated values and context
- What the audit record keeps

Prerequisite: the `Cratis` package, or `Cratis.Arc` alone for a command that records no event.

Keep the ID in the request when the caller already owns it. Put this command in `Features/Authors/Registration/RegisterAuthor.cs`. Use the existing `AuthorId` from `Library.Features.Authors` and `AuthorRegistered` from the command's namespace. `Cratis` supplies the framework global usings. Without those global usings, import `Cratis.Arc.Commands.ModelBound` for `[Command]`.

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

In the command scenario, use different IDs and assert the single append is to the book, not the borrower. This tests ownership, not the handler's field copy.

Before Arc 25.3.3, command-level `[EventSource<T>]` can fail before `Handle` when the host validates dependency injection scopes and the caller is unchanged. Upgrade to Arc 25.3.3 or later. If you can't upgrade, omit the attribute and wrap each event: `new EventForEventSourceId(id, fact) { EventSource = typeof(T), EventStream = "StreamName" }`. Use the stream name declared by `T`. This routes the append only; an injected per-stream read model still needs a matching command route.

## Read state to make a decision

Inject the read model into the validator constructor to refuse with a message, or into `Handle` to build the event. Under `On`, both reads guard the append. `[LookUpBy]` selects the read, not the append. For a book-owned `CreditAuthor` command, read the author by `AuthorId`:

```csharp
public AuthorCredited Handle([LookUpBy(nameof(CreditAuthor.AuthorId))] Author author) =>
    new(AuthorId, author.Name);
```

`LookUpBy` is in `Cratis.Arc.Commands`. Finding the author does not authorize changes to the book. A per-stream model follows the command's route, not `LookUpBy`. For a caller-derived, related, computed, or optional key, protect the decision with the Chronicle guard. Don't bypass the guard with a raw MongoDB or `IReadModels` read in `Provide`.

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

Arc calls `AuthorId.New()` for the generated parameter. The wrapper addresses the event to that ID; the first tuple item returns it to the caller. If the caller does not need the ID, return only the wrapper. Check `IsSuccess` before using the response. In the backend spec, import `Cratis.Arc.Testing.Commands` and insert `scenario.PinGeneratedValue("authorId", id);` before execution. Supply the fixed `AuthorId id` used by the append assertion.

## What `Handle` may return

| Return | What Arc does |
| --- | --- |
| `void` or `Task` | No response; a task is awaited. |
| An event, or a collection of events | Appended once to the command's event source. Not sent to the caller. |
| `EventForEventSourceId` | Appended to the source the wrapper names, whatever the command's own target is. |
| `ICommandOperation` | Executed on the server; never the response. |
| Any other value | Becomes the response. |
| A tuple | Each non-null element is handled on its own; at most one unhandled element becomes the response. |

Two unhandled tuple elements produce an exception-bearing result, not a two-field response: return one record instead. Declare an operation in the return type so its handling is evident.

## Which event source the command targets

1. `ICanProvideEventSourceId` wins.
2. Otherwise the first public property that is an `EventSourceId`, derives from `EventSourceId<T>` or carries Chronicle's `[Key]`. A typed property is not preferred over a `[Key]` property, and several candidates never form a composite key: declare exactly one.
3. With no candidate Arc generates a new identity, which suits creation only.

`[Key]` from `System.ComponentModel.DataAnnotations` is not Chronicle's `[Key]` and selects nothing. A returned `EventSourceId` addresses the returned events and becomes the response, but it arrives after dependencies were loaded: it never reloads a read model or retargets an aggregate. A returned raw `Guid` is only a response.

### Stream routing and completion

Source identity, stream selection and concurrency are separate decisions. Use `[EventStreamId("{A}:{B}")]` for a stream ID from command properties `A` and `B`; use `ICanProvideEventStreamId` instead when code must compute it. Combining a valued attribute (even a template) and the provider throws `AmbiguousEventStreamId`.

For an application-defined `AuthorHistory` event source with an `Edition` stream, derive the route with `var route = routes.For<AuthorHistory>("Edition").WithStreamId("first");`, where `routes` is `IEventRoutes` from `Cratis.Arc.Chronicle.Streams`. Use `IStreamReads.Stream(authorId, route)` to guard that exact stream, or `StreamType(authorId, route)` to guard every stream of that type for that source. Only one exact stream scope is available per source ID. Return `route.Route(authorId, fact)` to create an `EventForEventSourceId` with explicit routing that overrides the command context.

With Arc 22.81.0 and kernel 19.39.0 or later, return `CompleteStream` (for example `route.Complete()`) to close a non-default stream. Arc commits events first and completes separately. A declared source key, source provider or returned source ID scopes completion to that source; without one, completion applies across sources. For two authors with stream `Edition/first`, let a close command declare the first author's ID and return `route.Complete()`; verify a later append there is refused and the second author's stream still accepts writes. If completion fails after commit, retry completion alone; do not append the events again.

## `Provide`, generated values and context

- `Provide()` runs after filters succeed and passes its result into `Handle()`. It prepares a dependency; it does not add a response value, and it must not replace a caller-keyed or protected read.
- A `[GeneratedValue]` identity is guarded: the whole event source has to be empty when returned events or the command's unit of work target it. The guard does not cover an immediate event-log append, an external store or an ID the client supplied. Keep returning events; use `[GeneratedValue(Freshness = GeneratedValueFreshness.Unguarded)]` only for a destination that is meant to exist already.
- Arc validates a generated value after successful `Provide()` and before capture, including warning-level failures. `GeneratedValueRejected` is a server-generation fault, not a caller field refusal. Do not log or return the rejected value, including through validation message templates. Capture names are stable and case-sensitive. Pin an invalid generated value in a scenario and assert an exceptional result with no capture for that name; separately send invalid input and assert a field validation result without inspecting or logging the rejected value.
- Take the time from `CommandContext.ReceivedAt` and the caller from the pipeline rather than `DateTimeOffset.UtcNow`, so a scenario can fix them.

## What the audit record keeps

Arc copies public command values into each event's causation, separately from the event itself. `[PII]` and `[NotAudited]` on a top-level command property keep the value out. Exclusion is not recursive: mark the containing property or the command when nested data is sensitive. Encrypting the event property does not remove the command value from causation. Never store a password or token as a reversible event value.
