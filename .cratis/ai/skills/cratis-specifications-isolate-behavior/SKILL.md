---
name: cratis-specifications-isolate-behavior
description: Use when a .NET contributor needs a Cratis Specifications context for a decision that can be invoked directly. Not for pipeline behavior (use cratis-specifications-exercise-backend).
compatibility: With Cratis.Specifications.XUnit.v3 5.3.0, target .NET 10 or 11 in the specification project.
---

# Check a computed loan due date

Choose a direct spec when the handler decides something without the pipeline. For example, a library grants seven days for a short loan and 21 days otherwise, measured from the supplied borrowing date:

```csharp
public record BorrowBook(DateOnly BorrowedOn, bool ShortLoan)
{
    public BookBorrowed Handle() => new(BorrowedOn.AddDays(ShortLoan ? 7 : 21));
}
```

Here `BookBorrowed` carries a `DateOnly DueOn`. Use the actual rule in the feature; don't introduce a rule just to test a handler. If `Handle` only copies input into the event, write no direct spec. If binding or commitment is itself a consequential promise, one pipeline spec (the `cratis-specifications-exercise-backend` skill, when installed) covers it.

## Commit the spec at the decision

1. Use the repository's spec project with its application reference, `Cratis.Specifications.XUnit.v3` and xUnit v3 setup. The Cratis adapter brings `Cratis.Specifications`.
2. Arrange a fixed input in `Establish`; invoke `Handle` once in `Because`. Add a `given` context only for shared setup.
3. Assert the calculated date, not how the handler calculated it. For the seven-day rule, use `for_BorrowBook/when_borrowing_on_a_short_loan.cs`:

```csharp
using System;
using Cratis.Specifications;
using Library.Features.Books.Borrowing;
using Xunit;

namespace Library.Specs.for_BorrowBook;

public class when_borrowing_on_a_short_loan : Specification
{
    BorrowBook _command = null!;
    BookBorrowed _event = null!;

    void Establish() => _command = new(new DateOnly(2026, 1, 29), ShortLoan: true);
    void Because() => _event = _command.Handle();

    [Fact] public void should_be_due_in_seven_days() => _event.DueOn.ShouldEqual(new DateOnly(2026, 2, 5));
}
```

Facts observe the arranged instance and the result of `Because`; don't run a second action in a fact. If the decision depends on a pipeline-supplied value, configure it in a pipeline scenario instead. Don't duplicate the rule at both layers.

For the xUnit v3 executable setup (`<OutputType>Exe</OutputType>` and `xunit.v3.mtp-off`), build once and run the built spec executable. Do not substitute a solution-wide `dotnet test` across mixed runner projects. Facts share setup by default: keep them read-only. Move mutation to the act; if isolation is essential use `[PerFactSpecificationLifecycle]` on the class. See the upstream guide *Upgrading to Cratis Specifications 5.0*: keep adapter and core versions aligned, remove a hand-written framework assembly attribute to avoid CS0579, and keep net8/net9 projects on 4.x.
