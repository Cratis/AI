---
name: cratis-chronicle-protect-decision
description: Use when an Arc command must be accepted or refused from current event-derived state (a limit, stock, balance), and the refusal must hold under concurrent writers. Not for uniqueness (use cratis-chronicle-constrain-append).
compatibility: .NET SDK and an Arc host with Chronicle.
---

# Refuse borrowing if the last copy is no longer available

Inject the model into the validator for refusals or `Handle` to build the event. Both are protected under `On`.

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

In the validator spec, validate a `BorrowBook` against `null`, `new BookStock(isbn, 0)` and `new BookStock(isbn, 1)`; only the last should pass. This checks the rule, not the guard.

Optional manual check: in a disposable host with one copy left, pause at `Handle()` after validation. Append `BookBorrowed` from another process to the same book and namespace. Confirm that append, then resume. Expect a concurrency refusal and no second borrowing.

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

Return both events in one `IEnumerable<EventForEventSourceId>` batch: `BookBorrowed` to the book and `LoanTaken` to the member. Under `On`, a conflicting change to either guarded source refuses the batch. A lookup does not make a payload-keyed projection protectable.

### Where does the lookup key come from?

- Prefer an injected model: use the command's source key, `[LookUpBy(nameof(Property))]` for another command property, or `[LookUpBy<CallerSubject>]` in `Handle` for the authenticated subject.
- For a key on another protected model in the same member, Arc 25.2.0+ supports `[LookUpBy("order", nameof(OrderSummary.CustomerId))]`. The property must match the target key type; both reads are guarded under `On`.
- For keys injection can't express (such as a service-computed hash), compute the key in `Handle` under `On` and await the injected `IDecisionReads.Get<T>(key)`. Justify any `ARCCHR0040` suppression.

From Arc 25.1.0, a null or blank secondary scalar key gives a nullable model parameter `null` without a read or guard. A valid key with no instance still keeps its guard: if no matching event exists yet, the first matching append by someone else refuses this one. For required keys, reject blanks before invocation if you need a field message: acquisition can fail before validator rules run.

### Which scope guards the append?

Prefer the inferred guard. An explicit scope must cover each protected read's source, event types and stream without narrowing them, and expect a position at or before the read's, or expect no matching event. `ExplicitScopeDoesNotCoverReads` means fix or remove the scope. `ReadChanged` means the guard was invalidated, for example by a competing write; read again before resubmitting.

Mark advisory reads `[Unprotected("display only")]` (`Cratis.Arc.Chronicle.ReadModels`). A method annotation covers body reads, not injected parameters (`ARCCHR0034`). If a body read affects a decision, name its independent append guard.

Outside Arc's command pipeline, [guard the standalone append explicitly](references/standalone.md).

## Related skills

- [Validate command input](../cratis-arc-validate-command/SKILL.md)
- [Reserve a unique value](../cratis-chronicle-constrain-append/SKILL.md)
