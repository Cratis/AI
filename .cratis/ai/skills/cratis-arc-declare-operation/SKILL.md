---
name: cratis-arc-declare-operation
description: Use when a developer needs to reserve something with an external service before a command commits and undo the reservation on a known non-commit. Not for reacting after commit (use cratis-chronicle-react-to-fact).
compatibility: Requires the Cratis package and a reservation provider registered in DI.
---

# Reserve a library book

Choose a command operation when the provider work must run before the command commits. `Handle` returns an immutable operation record; Arc runs `Execute` and can run `Compensate` if the write fails without committing. Give both methods the same caller-supplied reservation identifier, including when the provider accepted the call but its acknowledgement was lost.

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

Use one operation for one provider action. Choose an ordered batch when several actions must run in order: if the command holds `Id, Book` and `SecondId, SecondBook`, use `public CommandOperations Handle() => [new ReserveBookOperation(Id, Book), new ReserveBookOperation(SecondId, SecondBook)];`. A plain array does not declare an operation batch. Import `Cratis.Arc.Commands` for `ICommandOperation` and `CommandOperations` if needed.

When a successful booking also needs a durable fact, mark `ReserveBook`'s `Id` parameter with `[Key]` (`Cratis.Chronicle.Keys`) so the reservation ID identifies the event source. Return a tuple containing the `BookReserved` event and the `ReserveBookOperation`. Arc enrolls the event, runs the reservation, then completes the event transaction. Send the confirmation from [a reactor on the committed fact](../cratis-chronicle-react-to-fact/SKILL.md), using the booking ID to deduplicate delivery. Do not send mail in `Execute`: canceling a reservation cannot unsend a message.

## Verify recovery through the pipeline

In the test, use `await using var scenario = new CommandScenario<ReserveBook>();` from `Cratis.Arc.Testing.Commands`. Register a test double `reservations` with `scenario.Services.AddSingleton<IBookReservations>(reservations);` (`Microsoft.Extensions.DependencyInjection`). Configure `Reserve` to fail after the provider may have accepted it, then run `var result = await scenario.Execute(new ReserveBook(id, book));`. Assert that `Cancel` receives the same reservation ID and the result still reports the original failure. For a batch, fail a later `Execute` and verify reverse-order recovery with the failed attempt first. Make one compensator fail and verify that Arc keeps the original failure and attempts the earlier compensators while the recovery budget remains.

## When it goes off the usual path

- **Commit is unknown or mixed:** reconcile the event and provider state before reversing anything. A failed response is not proof that nothing committed.
- **A committed outcome is wrong:** use [a corrective fact](../cratis-chronicle-evolve-event/SKILL.md) instead of calling `Compensate`.

## Avoid

- Do not generate the reservation ID or call the provider in `Handle`.
- Do not put the provider in the operation constructor; declare it on the methods.
- Do not return response data from `Execute`; use `void`, `Task` or `ValueTask`.
- Do not track success with a mutable flag or undo in a catch block. Let Arc decide recovery from the commit outcome.

## Related skills

- [Declare a command](../cratis-arc-declare-command/SKILL.md)
- [React after commit](../cratis-chronicle-react-to-fact/SKILL.md)
