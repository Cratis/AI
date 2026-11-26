---
name: cratis-specifications-exercise-backend
description: Exercises the backend boundary an assertion names. Use when testing Arc command execution, a Chronicle append, a materialized view or reactor dispatch. Not for testing a pure transition (use cratis-specifications-isolate-behavior).
compatibility: Requires the .NET SDK and matching Arc and Chronicle testing packages.
---

# Test that registration appends to the requested author

Run `RegisterAuthor` through the command pipeline. Check both success and the name on the event appended to the requested author ID.

1. In `Library.Specs`, reference the Library project, `Cratis.Arc.Chronicle.Testing`, `Cratis.Specifications.XUnit.v3` and `xunit.v3`. Keep the testing packages aligned with the application packages.
2. Put the context in `Library.Specs/for_RegisterAuthor/when_executing_author_registration.cs`. `AuthorId` comes from [declaring domain values](../cratis-fundamentals-name-value/SKILL.md); the command and event come from [delivering the registration slice](../cratis-platform-deliver-slice/SKILL.md).
3. Create the scenario before execution. Configure any required collaborators before it builds the service provider. Call `Execute` once and await the append assertion.

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
    async Task Destroy() => await _scenario.DisposeAsync();

    [Fact] public void should_accept_registration() => _result.ShouldBeSuccessful();
    [Fact] public async Task should_record_the_name_on_the_requested_author() =>
        await _scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(_id, x => x.Name == "Aster");
}
```

## Test other backend outcomes

- Refusal: arrange the conflicting state in a fresh scenario. Check the refusal reason and that the attempt appended nothing. Do not count arranged events as new appends.
- Append constraint: arrange the first claim in `EventScenario`, attempt a conflicting append on another source and assert the named violation.
- Projected row: supply events to `ReadModelScenario<TReadModel>` and check the row for the requested key.
- Reactor: use `ReactorScenario<TReactor>` to check the output destination or the call to its collaborator.

## Avoid

- Don't use `Validate` to test an append; it never executes the handler.
- Don't assert only the event type; check its destination and payload.
- Don't claim the in-memory scenario demonstrates delivery by a running host.

## Related skills

- [Isolate behavior](../cratis-specifications-isolate-behavior/SKILL.md) for a direct handler test.
