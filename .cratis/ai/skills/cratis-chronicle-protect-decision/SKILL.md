---
name: cratis-chronicle-protect-decision
description: Use when a maintainer needs a Chronicle append to refuse a command if its decision read has changed since validation. Not for reserving a unique value (use cratis-chronicle-constrain-append).
compatibility: .NET SDK and an Arc host with Chronicle.
---

# Refuse borrowing if the last copy is no longer available

1. Reference `Cratis.Arc.Chronicle`. Put the command and validator together in `Features/Books/Borrowing/`. Use `Isbn` as the command's only event-source-ID property: it selects both the book to read and the book to append to.
2. Put `public record Isbn(string Value) : EventSourceId<string>(Value);` in `Features/Books/Isbn.cs` (`Library.Features.Books`), and `[EventType] public record CopyAdded;` in `Features/Books/Stock/CopyAdded.cs` (`Library.Features.Books.Stock`); import `Cratis.Chronicle.Events` in both. Request `BookStock?` in the validator constructor. For a book with no events the validator receives `null` or an instance with `Available` 0; the rule refuses both.
3. Leave `CratisReadProtection` unset: the `Cratis.Arc.Chronicle` build props default it to `On`. Without those props do not assume the default. Check with `dotnet msbuild -getProperty:CratisReadProtection`. In deployment, leave `Cratis__Arc__ReadProtection__MaximumMode` unset or set it to `On`; don't lower the maximum when competing writes must be refused.

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

A validator test cannot prove commit protection. In a development host, set a debugger breakpoint on `BorrowBook.Handle()`. Submit a borrowing for a book with one copy and stop there after validation. From a separate process connected to the same kernel store and namespace, run `var competitor = await eventStore.EventLog.Append(isbn, new BookBorrowed());`. Verify `competitor.IsSuccess`, then continue the paused request. Expect HTTP 400, reason `concurrencyViolation`, detail `ReadChanged`, and no second borrowing event. Don't retry in the command: the client reads again and offers resubmission.

## Check which read actually guards the append

A plain typed parameter resolves by the command's event source ID. For a different key, use `[LookUpBy(nameof(CommandType.Property))]` and validate the relationship, a trusted `[LookUpBy<TProvider>]`, or a flat lookup projection. Per-stream models cannot be redirected this way. See [validate command input](../cratis-arc-validate-command/SKILL.md) for command wiring. The typed parameter under `On` enrolls the read. `concurrency: true` on routing metadata alone does not protect state read before the append scope is captured.

Keep decisions protected. Mark a genuinely advisory parameter `[Unprotected("display only")]` (`Cratis.Arc.Chronicle.ReadModels`). A method-level annotation covers body reads, not injected parameters (`ARCCHR0034`). If an exceptional body read influences a decision, the reason must name the independent append guard, such as a kernel constraint. Never overlay an explicit scope on the same protected read: conflicting expectations can raise `ExplicitScopeDoesNotCoverReads` rather than a clean concurrency refusal. Do not bypass typed injection with a raw keyed read in a command.

## Read and append explicitly outside the Arc pipeline

Choose an explicit decision read when writing outside Arc's command pipeline. Use the same `IEventStore` (including its store and namespace) for the decision and the write. Use a decision model eligible for protection, not an advisory read. For a single book, use the same source for both:

```csharp
var stock = await eventStore.GetDecisionReads().GetDetached<BookStock>(source);
if (!stock.IsProtected || stock.Instance is not { Available: > 0 }) return false;

var result = await eventStore.EventLog.AppendMany(
    [new EventForEventSourceId(source, new BookBorrowed())],
    guardedBy: [stock]);
return result.IsSuccess;
```

Here `source` is the book's Chronicle `EventSourceId` and the enclosing method returns `Task<bool>`. Import `Cratis.Chronicle`, `Cratis.Chronicle.Events`, `Cratis.Chronicle.EventSequences` and `Cratis.Chronicle.ReadModels`. If you need to distinguish a stale decision from other failures, inspect `result.GetDecisionConflicts([stock])`.

## When it goes off the usual path

- **A conflict rejects the write:** read the current stock and decide again before attempting another append.
- **Another writer bypasses the protected decision:** make it use `AppendMany(..., guardedBy: [stock])` as above. The guard applies only to the same store and namespace, and does not lock the book or check an external service.

Don't use a display query for stock. Request the decision model in the validator.

## Related skills

- [Validate command input](../cratis-arc-validate-command/SKILL.md)
- [Reserve a unique value](../cratis-chronicle-constrain-append/SKILL.md)
