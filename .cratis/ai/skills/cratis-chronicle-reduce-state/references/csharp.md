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

Default discovery recognizes the public static `Reduce` method on the model. No separate reducer registration or `Id` property is needed. Read `await eventStore.ReadModels.GetInstanceById<LoanDuration>(isbn.Value)` for that book, where `isbn.Value` is its string event source ID. To make this result available to a screen, expose a query (`cratis-arc-expose-query` skill in `cratis/arc/csharp`).

## Check the calculation

For an uncovered calculation, commit one direct spec: start with no model, fold returns of two and five days for one book, and expect an average of `3.5m`. This catches integer division as well as a fold that discards the previous loan. Don't repeat it in a hosted spec.

## Avoid

- Don't mutate previous state or calculate duration from today's date. Replay must use the recorded inputs.
- Keep `Reduce` on the model by default. Use a separate `IReducerFor<LoanDuration>` only for an unavoidable injected dependency whose answer is repeatable on replay; record changing external input as a fact instead.
- If the model assembly cannot reference Chronicle, the host can nominate a plain instance reducer with `options.ExplicitArtifacts.RegisterReducer<PlainLoanDurationReducer>()`. Do not also supply a self `Reduce` for that model; one builder owns it.

## Related skills

- [Map events onto a read model](../../cratis-chronicle-project-view/SKILL.md)
- Test a decision directly with `cratis-specifications-isolate-behavior` (in the `cratis/specifications/dotnet` profile).

When converting an existing reducer, preserve its observer identity, selected events, keys and decision-fold admission. A filtered or dependency-bearing reducer is not an equivalent replacement for an admissible unfiltered fold. A label does not filter delivery: configure metadata filters explicitly and seed matching source/stream/tag metadata in the test. Different partitions can run concurrently. Keep replay lifecycle work outside `Reduce`. On the model, optionally declare public static non-generic hooks returning exactly `Task`: `BeginReplay()`, `EndReplay()`, `BeginReplayPartition(Partition)`, and `EndReplayPartition(Partition)`. Import `Partition` from `Cratis.Chronicle.Observation` and make it the first parameter of either partition hook. After it (or as the only parameters of global hooks), use class/interface service dependencies only, not the event, model or `EventContext`. Chronicle resolves them in the notification’s async DI scope and awaits the hook and scope disposal. Do not assume full replay issues partition notifications, failure issues an end notification, or delivery is exactly once. See “Definition change replay” in `cratis-chronicle-inspect-observer` before changing a reducer with interleaved history.
