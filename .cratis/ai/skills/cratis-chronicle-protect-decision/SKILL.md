---
name: cratis-chronicle-protect-decision
description: Use when an Arc command must be accepted or refused from current event-derived state (a limit, stock, balance), and the refusal must hold under concurrent writers. Not for uniqueness (use cratis-chronicle-constrain-append).
compatibility: .NET SDK and an Arc host with Chronicle.
---

# Refuse borrowing if the last copy is no longer available

Refuse with a message → request the decision model in the validator. Need the state to build the event → take it as a `Handle` parameter. Both are protected by default.

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

## Check the stock rule

The committed spec covers the stock decision, not the framework guard. In the existing validator fixture use `var isbn = new Isbn("9780140327243"); var command = new BorrowBook(isbn);`. Both `new BorrowBookValidator(null).Validate(command).IsValid` and `new BorrowBookValidator(new BookStock(isbn, 0)).Validate(command).IsValid` must be false. With `new BookStock(isbn, 1)` the same check must be true.

Optional manual check for a human, not an automated race spec: in a disposable host, pause at `Handle()` after validation with one copy left. From another process append `BookBorrowed` to that book in the same namespace. Confirm the append succeeded, then resume the request. Expect a concurrency refusal and no second borrowing. Read the current stock before offering resubmission.

## Check which read actually guards the append

For a three-loan limit, give `BorrowBook` a `MemberId` property. Count `LoanTaken` and `LoanReturned` facts appended **to the member**, not book events grouped by a payload property. The validator constructor selects each source separately:

```csharp
public BorrowBookValidator(
    [LookUpBy(nameof(BorrowBook.Isbn))] BookStock? stock,
    [LookUpBy(nameof(BorrowBook.MemberId))] MemberLoans? loans)
{
    RuleFor(c => c.Isbn).Must(_ => stock is { Available: > 0 })
        .WithMessage("No copies of this book are available.");
    RuleFor(c => c.MemberId).Must(_ => loans is null || loans.Active < 3)
        .WithMessage("The member has reached the loan limit.");
}
```

Return both events in one `IEnumerable<EventForEventSourceId>` batch: `BookBorrowed` to the book and `LoanTaken` to the member. Under `On`, a conflicting change to either guarded source refuses the batch. `LookUpBy` selects a source from the command; it cannot protect a projection keyed by an event payload property.

Keep decisions protected. Mark a genuinely advisory parameter `[Unprotected("display only")]` (`Cratis.Arc.Chronicle.ReadModels`). A method-level annotation covers body reads, not injected parameters (`ARCCHR0034`). If an exceptional body read influences a decision, the reason must name the independent append guard, such as a kernel constraint. Never overlay an explicit scope on the same protected read: conflicting expectations can raise `ExplicitScopeDoesNotCoverReads` rather than a clean concurrency refusal. Do not bypass typed injection with a raw keyed read in a command.

Outside Arc's command pipeline, [guard the standalone append explicitly](references/standalone.md).

## Related skills

- [Validate command input](../cratis-arc-validate-command/SKILL.md)
- [Reserve a unique value](../cratis-chronicle-constrain-append/SKILL.md)
