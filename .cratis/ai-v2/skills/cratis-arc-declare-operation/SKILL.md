---
name: cratis-arc-declare-operation
description: Returns a compensatable provider call from a command. Use when reserving a library book through an external service. Not for reacting after commit (use cratis-chronicle-react-to-fact).
compatibility: Requires the Cratis package and a reservation provider registered in DI.
---

# Reserve a library book

Use an immutable operation record for the work. `Handle` returns it; Arc runs `Execute` and can run `Compensate` if the write fails without committing. Give both methods the same caller-supplied reservation identifier, including when the provider accepted the call but its acknowledgement was lost.

In `Books/ReserveBook.cs`, using the `Cratis` global usings:

```csharp
namespace Catalog.Books;

public record ReservationId(Guid Value) : ConceptAs<Guid>(Value);
public record BookId(Guid Value) : ConceptAs<Guid>(Value);

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

The host needs a provider that implements `IBookReservations`. If the implementation is `BookReservations`, register `builder.Services.AddScoped<IBookReservations, BookReservations>()` before `Build()` in `Program.cs`. Use a reservation ID unique to the caller's booking attempt. The provider must bind that ID to the authenticated owner, tenant and book, reject conflicting reuse and protect finalized reservations. `Cancel` must be safe when the attempted reservation does not exist. Possession of an ID is not permission to cancel a booking.

## Avoid

- Do not generate the reservation ID or call the provider in `Handle`.
- Do not put the provider in the operation constructor; declare it on the methods.
- Do not return response data from `Execute`; use `void`, `Task` or `ValueTask`.
- Do not track success with a mutable flag or undo in a catch block. Arc compensates attempted operations in reverse order for `NoCommit` or `NotCommitted`, not a committed or unknown outcome.

## Related skills

- [Declare a command](../cratis-arc-declare-command/SKILL.md)
- [React after commit](../cratis-chronicle-react-to-fact/SKILL.md)
