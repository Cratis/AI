---
name: cratis-chronicle-reduce-state
description: Use when a maintainer needs to fold a Chronicle event and prior state into a read model with a static Reduce method. Not for accepting or refusing a command (use cratis-chronicle-protect-decision).
compatibility: .NET SDK and Chronicle reducers.
---

# Calculate how many copies of a book are on loan

Start with a projection for field mappings and plain counters, even when a counter accumulates prior state. Choose a static model reducer when the next value depends on a rule the projection cannot express: here, loans are capped at the number of copies and a loan cannot create a missing book.

The reducer maintains a view of recorded facts; deciding whether to accept the borrow belongs in the command. Keep `Reduce` on the model. A separate `IReducerFor<BookAvailability>` is an extreme exception for an unavoidable injected dependency whose result is repeatable on replay, not the usual shape for a fold. Record changing external input as a fact instead.

1. Reference `Cratis.Chronicle` and put `BookAvailability` in the book availability feature folder of the backend assembly. Import `CopyAdded` and `BookBorrowed` from [Protect a command decision](../cratis-chronicle-protect-decision/SKILL.md). Chronicle's default discovery recognizes public static reducer methods on the model; do not register a separate reducer service.
2. Put a public static `Reduce` method on the record for each event. Take the typed event first, then the nullable previous model. The first `CopyAdded` starts the model with one copy and no loans. Each subsequent `CopyAdded` adds one copy without changing the loan count.
3. For `BookBorrowed`, return a new instance with one more copy on loan, up to the number of copies. Return `null` if the book hasn't been added: borrowing alone cannot create availability.

```csharp
// Features/Books/Availability/BookAvailability.cs
using Library.Features.Books.Borrowing;
using Library.Features.Books.Stock;

namespace Library.Features.Books.Availability;

public record BookAvailability(int Copies, int OnLoan)
{
    public static BookAvailability Reduce(CopyAdded @event, BookAvailability? current) =>
        current is null ? new(1, 0) : current with { Copies = current.Copies + 1 };

    public static BookAvailability? Reduce(BookBorrowed @event, BookAvailability? current) =>
        current is null ? null : current with { OnLoan = Math.Min(current.Copies, current.OnLoan + 1) };
}
```

## Check each loan count

Call `BookAvailability.Reduce` directly in a test. `BookAvailability.Reduce(new BookBorrowed(), null)` is null. Add two copies with two `new CopyAdded()` events, then borrow three times, passing each result as `current`: `OnLoan` is 1, 2, 2. The instance returned after the second `CopyAdded` still has `OnLoan` 0.

## Avoid

- Don't mutate the previous instance. Return a new record with `with`.
- Don't try to change the key in the return value. Chronicle uses the event source ID of the event.

## When it goes off the usual path

- **The result depends on when the test runs:** call the loan-count test twice with the same facts from `current = null` and compare the final records. Keep durable state in the returned record, not in static fields.
- **The calculation needs outside data:** record the needed input as a fact first. Don't call a service from `Reduce`; replay must use the recorded inputs, not today's answers.

## Related skills

- [Map events onto a read model](../cratis-chronicle-project-view/SKILL.md)
- [Test a backend feature](../cratis-specifications-exercise-backend/SKILL.md)
