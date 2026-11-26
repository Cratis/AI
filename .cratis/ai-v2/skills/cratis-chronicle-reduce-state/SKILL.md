---
name: cratis-chronicle-reduce-state
description: Calculates Chronicle read-model state from successive events. Use when a reducer needs the previous value and the event. Not for copying event fields directly (use cratis-chronicle-project-view).
compatibility: .NET SDK and Chronicle reducers.
---

# Calculate how many copies of a book are on loan

1. Reference `Cratis.Chronicle` and put `BookAvailability` in the book availability feature folder of the backend assembly. Chronicle's default discovery recognizes public static reducer methods on the model; do not register a separate reducer service.
2. Put a public static `Reduce` method on the record for each event. Take the typed event first, then the nullable previous model. `BookAdded` sets the number of copies and starts the loan count at zero.
3. For `BookBorrowed`, return a new instance with one more copy on loan, up to the number of copies. Return `null` if the book hasn't been added: borrowing alone cannot create availability.

```csharp
// Features/Books/Availability/BookAvailability.cs
using Cratis.Chronicle.Events;

namespace Library.Books.Availability;

[EventType] public record BookAdded(int Copies);
[EventType] public record BookBorrowed;

public record BookAvailability(int Copies, int OnLoan)
{
    public static BookAvailability Reduce(BookAdded @event, BookAvailability? current) =>
        new(@event.Copies, 0);

    public static BookAvailability? Reduce(BookBorrowed @event, BookAvailability? current) =>
        current is null ? null : current with { OnLoan = Math.Min(current.Copies, current.OnLoan + 1) };
}
```

## Check each loan count

Before `BookAdded`, expect no model. Start with two copies and borrow three times. Expect successive loan counts of one, two and two. The original instance must still have zero loans.

## Avoid

- Don't fetch stock from another service inside `Reduce`. Compute it from the event and previous model.
- Don't mutate the previous instance. Return a new record with `with`.
- Don't try to change the key in the return value. Chronicle uses the event source ID of the event.

## Related skills

- [Map events onto a read model](../cratis-chronicle-project-view/SKILL.md)
- [Test a backend feature](../cratis-specifications-exercise-backend/SKILL.md)
