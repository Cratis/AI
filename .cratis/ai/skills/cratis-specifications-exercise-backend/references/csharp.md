# Exercise a C# backend

## Choose the harness by artifact

| Promise | Harness | Package |
| --- | --- | --- |
| A decision invoked without the pipeline | A plain call | none |
| Binding, authorization, validation, commitment of a command | `CommandScenario<TCommand>` | `Cratis.Arc.Testing`; add `Cratis.Arc.Chronicle.Testing` to seed and assert events |
| A query through its pipeline | `QueryScenario<TReadModel>` | `Cratis.Arc.Testing` |
| An append contract or a constraint | `EventScenario` | `Cratis.Chronicle.Testing` |
| The row a projection or reducer produces | `ReadModelScenario<TReadModel>` | `Cratis.Chronicle.Testing` |
| The effect a reactor returns | `ReactorScenario<TReactor>` | `Cratis.Chronicle.Testing` |
| Discovery, persistence or observer delivery | A running store | `Cratis.Chronicle.XUnit.Integration.v3` |

`Cratis.Testing` is a meta package that brings the Arc and Chronicle testing packages together. Use the versions that match the application's Arc and Chronicle packages.

## Reject an empty author name

Reference the application, `Cratis.Arc.Chronicle.Testing`, `Cratis.Specifications.XUnit.v3` and the repository's xUnit v3 test setup in the spec project. This example assumes `RegisterAuthor` takes the source ID and name, and its validator rejects an empty name with `Name is required`. Another registration is seeded to tell earlier history from this command's work.

```csharp
using System.Threading.Tasks;
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Commands;
using Cratis.Arc.Testing.Commands;
using Cratis.Specifications;
using Library.Features.Authors;
using Library.Features.Authors.Registration;
using Xunit;

namespace Library.Specs.for_RegisterAuthor;

public class when_submitting_an_empty_name : Specification
{
    readonly CommandScenario<RegisterAuthor> _scenario = new();
    CommandResult _result = null!;

    void Establish() => _scenario.Given.ForEventSource(AuthorId.New()).Events(new AuthorRegistered("Aster"));
    async Task Because() => _result = await _scenario.Execute(new RegisterAuthor(AuthorId.New(), ""));
    void Destroy() => _scenario.Dispose();

    [Fact] public void should_refuse_registration() => _result.ShouldNotBeSuccessful();
    [Fact] public void should_explain_the_refusal() => _result.ShouldHaveValidationErrorFor("Name is required");
    [Fact] public async Task should_not_append_an_event() => await _scenario.ShouldNotHaveAppendedEvents();
}
```

Run the spec project; all three facts pass. If `should_explain_the_refusal` fails while `should_refuse_registration` passes, something other than the name rule refused the command: read [csharp-command-results.md](csharp-command-results.md) for the reason assertions.

If the handler decides which author receives the event, exercise that accepted case once with the requested `id` and `"Aster"`. Check `result.ShouldBeSuccessful()` and await `scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(id, e => e.Name == "Aster")`.

Await the event assertions that return `Task`. Chronicle’s analyzer treats an unawaited async assertion as error `CHR0039`; without it, a faulted task can go unobserved.

## Check the projected row instead

With `Cratis.Chronicle.Testing`, create a `ReadModelScenario<Author>` for the application's projection. Apply `await scenario.Given.ForEventSource(id).Events(new AuthorRegistered("Aster"));` once. Require `scenario.Instance` to have that ID and name, then dispose the scenario during cleanup. That proves the mapping, not the live subscription. [csharp-integration.md](csharp-integration.md) covers keys, siblings, removal and seeded state.

## Prove delivery in a running store

Use an isolated running store with the projection registered. Check the append result first, await `WaitForCompletion()` on that append result (import `Cratis.Chronicle.Observation`), require `IsSuccess` on what it returns and query the stored row by the same ID. When a query also filters by caller, check the returned IDs as that caller; the stored row alone cannot prove visibility.
