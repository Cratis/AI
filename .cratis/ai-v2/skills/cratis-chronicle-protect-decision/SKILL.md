---
name: cratis-chronicle-protect-decision
description: Use when the Chronicle state a command validated must still hold at commit, such as a check for available stock. Not for reserving a unique value (use cratis-chronicle-constrain-append).
compatibility: .NET SDK and an Arc host with Chronicle.
---

# Refuse borrowing if the last copy is no longer available

1. Reference `Cratis.Arc.Chronicle`. Put the command and validator together in `Features/Books/Borrowing/`. Use `Isbn` as the command's only event-source-ID property: it selects both the book to read and the book to append to.
2. Put `public record Isbn(string Value) : EventSourceId<string>(Value);` in `Features/Books/Isbn.cs` (`Library.Features.Books`), and `[EventType] public record CopyAdded;` in `Features/Books/Stock/CopyAdded.cs` (`Library.Features.Books.Stock`); import `Cratis.Chronicle.Events` in both. Request `BookStock?` in the validator constructor. For a book with no events the validator receives `null` or an instance with `Available` 0; the rule refuses both.
3. Leave `<CratisReadProtection>` at the package default, `On`. Don't set it to `Measure` or `Off` when a competing write must reject the command. Check `Cratis:Arc:ReadProtection:MaximumMode` in deployment configuration; leave it unset or `On`.

```csharp
// Features/Books/Borrowing/BorrowBook.cs
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Chronicle.ReadModels;
using Library.Features.Books;
using Library.Features.Books.Stock;
using FluentValidation;

namespace Library.Features.Books.Borrowing;

// BookBorrowed.cs
[EventType] public record BookBorrowed;

// BookStock.cs
[Passive, ReadModel]
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

In the validator test use `var isbn = new Isbn("9780140327243"); var command = new BorrowBook(isbn);`. Both `new BorrowBookValidator(null).Validate(command).IsValid` and `new BorrowBookValidator(new BookStock(isbn, 0)).Validate(command).IsValid` must be false. With `new BookStock(isbn, 1)` the same check must be true.

A validator test cannot prove commit protection. In a development host, set a debugger breakpoint on `BorrowBook.Handle()`. Submit a borrowing for a book with one copy and stop there after validation. From a separate process connected to the same kernel store and namespace, append `new BookBorrowed()` to the same ISBN and check acceptance, then continue the paused request. Expect HTTP 400, reason `concurrencyViolation`, detail `ReadChanged`, and no second borrowing event. Don't retry in the command: the client reads again and offers resubmission.

## Read and append explicitly outside the Arc pipeline

Choose an explicit decision read when writing outside Arc's command pipeline. Use the same `IEventStore` (including its store and namespace) for the decision and the write. For a single book, use the same source for both:

```csharp
var stock = await eventStore.GetDecisionReads().GetDetached<BookStock>(source);
if (stock.Instance is not { Available: > 0 }) return false;

var result = await eventStore.EventLog.AppendMany(
    [new EventForEventSourceId(source, new BookBorrowed())],
    guardedBy: [stock]);
return result.IsSuccess;
```

Here `source` is the book's Chronicle `EventSourceId` and the enclosing method returns `Task<bool>`. Import `Cratis.Chronicle`, `Cratis.Chronicle.Events`, `Cratis.Chronicle.EventSequences` and `Cratis.Chronicle.ReadModels`. If you need to distinguish a stale decision from other failures, inspect `result.GetDecisionConflicts([stock])`.

## When it goes off the usual path

- **A conflict rejects the write:** read the current stock and decide again before attempting another append.
- **The rule must hold for every writer:** use an append constraint when it can express the invariant. The guard checks changes at commit; it does not lock the book, cover reads from another store or an external service, or enforce the rule for writers that omit a protected decision.

Don't use a display query for stock. Request the decision model in the validator.

## Related skills

- [Validate command input](../cratis-arc-validate-command/SKILL.md)
- [Reserve a unique value](../cratis-chronicle-constrain-append/SKILL.md)
