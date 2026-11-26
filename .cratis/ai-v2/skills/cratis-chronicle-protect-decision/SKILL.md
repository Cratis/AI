---
name: cratis-chronicle-protect-decision
description: Guards a command against changes to the Chronicle state it validated. Use when available stock must still be valid at commit. Not for reserving a unique value (use cratis-chronicle-constrain-append).
compatibility: .NET SDK and an Arc host with Chronicle.
---

# Refuse borrowing if the last copy is no longer available

1. Reference `Cratis.Arc.Chronicle`. Put the command and validator together in `Features/Books/Borrowing/`. Use `Isbn` as the command's only event-source-ID property: it selects both the book to read and the book to append to.
2. Request `BookStock?` in the validator constructor. A book with no events has no read model; a missing model must not allow borrowing.
3. Leave `<CratisReadProtection>` at the package default, `On`. Don't set it to `Measure` or `Off` when a competing write must reject the command. Check `Cratis:Arc:ReadProtection:MaximumMode` in deployment configuration; it must not lower protection below `On`.

```csharp
// Features/Books/Borrowing/BorrowBook.cs
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using FluentValidation;

namespace Library.Books.Borrowing;

public record Isbn(string Value) : EventSourceId<string>(Value);
[EventType] public record CopyAdded;
[EventType] public record BookBorrowed;

[ReadModel]
public record BookStock(Isbn Id, [Increment<CopyAdded>, Decrement<BookBorrowed>] int Available);

[Command]
public record BorrowBook(Isbn Isbn)
{
    public BookBorrowed Handle() => new();
}

public class BorrowBookValidator : CommandValidator<BorrowBook>
{
    public BorrowBookValidator(BookStock? stock) =>
        RuleFor(command => command.Isbn)
            .Must(_ => stock is { Available: > 0 })
            .WithMessage("No copies of this book are available.");
}
```

## Check the decision and the commit

Run the command with one available copy, no copies and a missing book. Only the first may append `BookBorrowed`. To check concurrency, consume the last copy between validation and commit. The stale borrowing must be refused without another `BookBorrowed` event.

## Avoid

- Don't use a display query for stock. Request the decision model in the validator.
- Don't add a read-protection attribute merely to repeat the project default.
- Don't rely on `Measure` to reject writes: it only reports conflicts.

## Related skills

- [Validate command input](../cratis-arc-validate-command/SKILL.md)
- [Reserve a unique value](../cratis-chronicle-constrain-append/SKILL.md)
