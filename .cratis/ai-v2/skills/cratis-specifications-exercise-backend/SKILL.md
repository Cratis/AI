---
name: cratis-specifications-exercise-backend
description: Use when testing Arc command execution and its Chronicle append, such as checking that registration is recorded on the requested author or that a refusal appends nothing. Not for a direct handler test (use cratis-specifications-isolate-behavior).
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

## Avoid

- Don't call `Validate` to check an append; it does not execute the handler.
- Don't assert only the event type; check the requested ID and submitted name.

## Related skills

- [Isolate behavior](../cratis-specifications-isolate-behavior/SKILL.md) when the assertion concerns only the event returned by `Handle()`.
