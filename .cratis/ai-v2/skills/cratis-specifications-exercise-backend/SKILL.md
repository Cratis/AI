---
name: cratis-specifications-exercise-backend
description: Use when testing an Arc command's append or refusal, or checking the row a Chronicle projection builds from an event. Not for a direct handler test (use cratis-specifications-isolate-behavior).
compatibility: Requires the .NET SDK and matching Arc and Chronicle testing packages.
---

# Test the registration append and empty-name refusal

1. In `Library.Specs`, reference the Library project, `Cratis.Arc.Chronicle.Testing`, `Cratis.Specifications.XUnit.v3`, `xunit.v3`, `Microsoft.NET.Test.Sdk` and `xunit.runner.visualstudio`. Keep the Arc testing package on the same version as the application's Arc packages.
2. Use [RegisterAuthor](../cratis-arc-declare-command/SKILL.md), [AuthorRegistered](../cratis-chronicle-record-event/SKILL.md), [AuthorId](../cratis-fundamentals-name-value/SKILL.md) and [RegisterAuthorValidator](../cratis-arc-validate-command/SKILL.md) from the referenced application. The validator must reject empty `Name` with `Name is required`.
3. In `Library.Specs/for_RegisterAuthor/when_executing_author_registration.cs`, submit once and check both the command result and addressed payload:

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

public class when_executing_author_registration : Specification
{
    readonly CommandScenario<RegisterAuthor> _scenario = new();
    readonly AuthorId _id = AuthorId.New();
    CommandResult _result = null!;

    async Task Because() => _result = await _scenario.Execute(new RegisterAuthor(_id, "Aster"));
    void Destroy() => _scenario.Dispose();

    [Fact] public void should_accept_registration() => _result.ShouldBeSuccessful();
    [Fact] public async Task should_record_the_name_on_the_requested_author() =>
        await _scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(_id, e => e.Name == "Aster");
}
```

4. In `when_submitting_an_empty_name.cs` in the same folder, use the same imports and namespace. Give this context its own scenario. Seed another author's history so that the assertion distinguishes prior history from a new append:

```csharp
public class when_submitting_an_empty_name : Specification
{
    readonly CommandScenario<RegisterAuthor> _scenario = new();
    CommandResult _result = null!;

    void Establish() => _scenario.Given.ForEventSource(AuthorId.New()).Events(new AuthorRegistered("Aster"));
    async Task Because() => _result = await _scenario.Execute(new RegisterAuthor(AuthorId.New(), ""));
    void Destroy() => _scenario.Dispose();

    [Fact] public void should_refuse_registration() => _result.ShouldNotBeSuccessful();
    [Fact] public void should_explain_the_refusal() =>
        _result.ShouldHaveValidationErrorFor("Name is required");
    [Fact] public async Task should_not_append_an_event() => await _scenario.ShouldNotHaveAppendedEvents();
}
```

## Test the projected author

Reference `Cratis.Chronicle.Testing` and use the application's [Author projection](../cratis-chronicle-project-view/SKILL.md). In `Library.Specs/for_Author/when_projecting_a_registration.cs`, apply the registration to one source and check the resulting row:

```csharp
using System.Threading.Tasks;
using Cratis.Chronicle.Testing.ReadModels;
using Cratis.Specifications;
using Library.Features.Authors;
using Library.Features.Authors.Listing;
using Library.Features.Authors.Registration;
using Xunit;

namespace Library.Specs.for_Author;

public class when_projecting_a_registration : Specification
{
    readonly AuthorId _id = AuthorId.New();
    readonly ReadModelScenario<Author> _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_id).Events(new AuthorRegistered("Aster"));
    void Destroy() => _scenario.Dispose();

    [Fact] public void should_identify_the_author() => _scenario.Instance!.Id.ShouldEqual(_id);
    [Fact] public void should_display_the_registered_name() => _scenario.Instance!.Name.ShouldEqual("Aster");
}
```

This checks the mapping in process, not observer delivery. In a running-store test, make sure the host has discovered the `Author` projection, then append to the test author's history and assert the append succeeded. Await `WaitForCompletion()` on that append result (import `Cratis.Chronicle.Observation`); require success with no failed partitions before querying the stored row for the same ID and name. A fixed sleep does not establish that the observer handled this write.

For a command that decides from a read model, seed the prerequisite events in order with `_scenario.Given.ForEventSource(id).Events(...)` in `Establish`. Include the events needed to materialize the decision state, not just the last change. In `Because`, execute against that same source. Verify the command outcome and what that execution appended, separately from the seeded history.

## Avoid

- Don't call `Validate` to check an append; it does not execute the handler.
- Don't assert only the event type; check the requested ID and submitted name.

## Related skills

- [Isolate behavior](../cratis-specifications-isolate-behavior/SKILL.md) when the assertion concerns only the event returned by `Handle()`.
