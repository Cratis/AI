---
name: cratis-arc-declare-operation
description: Use when a command needs a compensatable operation to call an external service and undo the provider call if the command fails without committing. Not for reacting after commit (use cratis-chronicle-react-to-fact).
compatibility: Requires the Cratis package and a reservation provider registered in DI.
---

# Reserve a library book

Use an immutable operation record for the work. `Handle` returns it; Arc runs `Execute` and can run `Compensate` if the write fails without committing. Give both methods the same caller-supplied reservation identifier, including when the provider accepted the call but its acknowledgement was lost.

In `Features/Books/Reservations/`, put `ReservationId` in `ReservationId.cs` and `BookId` in `BookId.cs`. Both files use `namespace Library.Features.Books.Reservations;` and the `Cratis` global usings:

```csharp
public record ReservationId(Guid Value) : ConceptAs<Guid>(Value);
public record BookId(Guid Value) : ConceptAs<Guid>(Value);
```

Place the provider interface, command and operation in `Features/Books/Reservations/ReserveBook.cs`:

```csharp
namespace Library.Features.Books.Reservations;

public interface IBookReservations
{
    Task Reserve(ReservationId id, BookId book, CancellationToken cancellationToken);
    Task Cancel(ReservationId id, CancellationToken cancellationToken);
}

[Command]
public record ReserveBook(ReservationId Id, BookId Book)
{
    public ReserveBookOperation Handle() => new(Id, Book);
}

public record ReserveBookOperation(ReservationId Id, BookId Book) : ICommandOperation
{
    public Task Execute(IBookReservations reservations, CancellationToken cancellationToken) =>
        reservations.Reserve(Id, Book, cancellationToken);

    public Task Compensate(IBookReservations reservations, CancellationToken cancellationToken) =>
        reservations.Cancel(Id, cancellationToken);
}
```

Implement `IBookReservations` in `Features/Books/Reservations/BookReservations.cs` as `BookReservations` and register it before `Build()` in `Program.cs`: `builder.Services.AddScoped<IBookReservations, BookReservations>();`. The caller chooses one `ReservationId` per booking attempt. For the same owner, tenant, book and ID, a repeated `Reserve` must not create a second booking. Reject reuse for a different request. `Cancel` removes only this attempt's pending reservation; it succeeds without removing anything if that reservation is absent or already confirmed. This also covers a lost provider acknowledgement: Arc can compensate an attempted `Execute` even when it threw before returning.

To also append a fact, return `(Fact, Operation)` when the command already identifies the event source. With an explicit Chronicle source, keep the source and event together: return `(EventForEventSourceId, Operation)` with `(new EventForEventSourceId(source, fact), operation)`, not a flat triple. Here `Fact` and `Operation` stand for your concrete types. Import `Cratis.Arc.Commands` for `ICommandOperation` and `Cratis.Chronicle.EventSequences` for the event wrapper if not globally imported.

## Avoid

- Do not generate the reservation ID or call the provider in `Handle`.
- Do not put the provider in the operation constructor; declare it on the methods.
- Do not return response data from `Execute`; use `void`, `Task` or `ValueTask`.
- Do not track success with a mutable flag or undo in a catch block. Arc compensates attempted operations in reverse order for `NoCommit` or `NotCommitted`, not a committed or unknown outcome.

## Related skills

- [Declare a command](../cratis-arc-declare-command/SKILL.md)
- [React after commit](../cratis-chronicle-react-to-fact/SKILL.md)
