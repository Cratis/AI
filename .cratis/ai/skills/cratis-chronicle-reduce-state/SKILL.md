---
name: cratis-chronicle-reduce-state
description: Use when a maintainer needs to fold a Chronicle event and prior state into a read model with a static Reduce method. Not for accepting or refusing a command (use cratis-chronicle-protect-decision).
compatibility: .NET SDK and Chronicle reducers.
---

# Calculate the average completed loan duration for a book

Start with a projection for field mappings and plain counters. Choose a static model reducer for a calculation that needs prior state and cannot be expressed with projection mappings. This example calculates the mean duration across completed loans. It describes recorded facts; it doesn't decide whether to accept another loan.

In the book's loan reporting feature, record the completed loan's duration on the return event and append it to the book's event source. Keep the fold on the read model:

```csharp
using Cratis.Chronicle.Events;

namespace Library.Features.Books.Reporting;

[EventType] public record BookReturned(int DaysOnLoan);

public record LoanDuration(int CompletedLoans, long TotalDays, decimal AverageDays)
{
    public static LoanDuration Reduce(BookReturned returned, LoanDuration? current)
    {
        var count = (current?.CompletedLoans ?? 0) + 1;
        var total = (current?.TotalDays ?? 0L) + returned.DaysOnLoan;
        return new(count, total, (decimal)total / count);
    }
}
```

Default discovery recognizes the public static `Reduce` method on the model. No separate reducer registration or `Id` property is needed. Read `await eventStore.ReadModels.GetInstanceById<LoanDuration>(isbn.Value)` for that book, where `isbn.Value` is its string event source ID. To make this result available to a screen, [expose a query](../cratis-arc-expose-query/SKILL.md).

## Check the calculation

For an uncovered calculation, commit one direct spec: start with no model, fold returns of two and five days for one book, and expect an average of `3.5m`. This catches integer division as well as a fold that discards the previous loan. Don't repeat it in a hosted spec.

## Avoid

- Don't mutate previous state or calculate duration from today's date. Replay must use the recorded inputs.
- Keep `Reduce` on the model. A separate `IReducerFor<LoanDuration>` is an extreme exception for an unavoidable injected dependency whose answer is repeatable on replay. Record changing external input as a fact instead.

## Related skills

- [Map events onto a read model](../cratis-chronicle-project-view/SKILL.md)
- [Test a decision directly](../cratis-specifications-isolate-behavior/SKILL.md)
