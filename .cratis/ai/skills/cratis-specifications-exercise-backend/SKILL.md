---
name: cratis-specifications-exercise-backend
description: Use when a backend author needs to check which event an Arc command appends, why it refuses input, or which row Chronicle projects. Not for a decision invoked without the pipeline (use cratis-specifications-isolate-behavior).
compatibility: Requires the .NET SDK, the Cratis Specifications xUnit v3 adapter and the testing packages matching the application's Arc or Chronicle versions.
---

# Test the backend promise at its owner

Use a command scenario when the promise depends on binding, authorization, validation or commitment. For a row mapping, use a read-model scenario instead. Reserve a running store for behavior that depends on discovery, actual persistence or observer delivery.

Commit one spec per uncovered consequential rule. Add the accepted case only when the handler decides something. See the [case defaults](../../rules/general.md); don't duplicate a decision already covered directly.

## Reject an empty author name

Reference the application, `Cratis.Arc.Chronicle.Testing`, `Cratis.Specifications.XUnit.v3` and the repository's xUnit v3 test setup in the spec project. This example assumes `RegisterAuthor` takes the source ID and name, and its validator rejects an empty name with `Name is required`. Seed another registration to distinguish earlier history from this command's work.

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

If the handler decides which author receives the event, exercise that accepted case once with the requested `id` and `"Aster"`. Check `result.ShouldBeSuccessful()` and await `scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(id, e => e.Name == "Aster")`. Checking only a returned object would miss a write addressed to the wrong author. If a refusal test passes because authorization rejected the caller, it hasn't checked the name rule: inspect the structured reason.

## Check the projected row instead

With `Cratis.Chronicle.Testing`, create a `ReadModelScenario<Author>` for the application's projection. Apply `await scenario.Given.ForEventSource(id).Events(new AuthorRegistered("Aster"));` once. Require `scenario.Instance` to have that ID and name, then dispose the scenario during cleanup. That proves the mapping, not the live subscription.

For a delivery promise, use an isolated running store with the projection registered. Check the append result first, await `WaitForCompletion()` on that append result (import `Cratis.Chronicle.Observation`), require successful observation and query the stored row by the same ID. A fixed sleep cannot distinguish a slow observer from a failed one. When a query also filters by caller, check the returned IDs as that caller; the stored row alone cannot prove visibility.
