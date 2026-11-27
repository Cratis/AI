---
name: cratis-specifications-isolate-behavior
description: Use when testing an isolated .NET decision with Cratis Specifications or structuring its pure behavior spec, shared context or xUnit runner. Not for exercising the Arc pipeline (use cratis-specifications-exercise-backend).
compatibility: Requires the .NET SDK and the xUnit v3 specification runner.
---

# Test what RegisterAuthor.Handle returns

Call the registration handler once and assert its returned `AuthorRegistered`. Don't start a host or mock an event log when the handler only returns a fact.

1. Reference the Library project, `Cratis.Specifications.XUnit.v3`, `xunit.v3`, `Microsoft.NET.Test.Sdk` and `xunit.runner.visualstudio` in `Library.Specs`. The Cratis xUnit adapter brings `Cratis.Specifications`; do not add a separate version.
2. Put one behavior context in `Library.Specs/for_RegisterAuthor/when_registering_an_author.cs`. Choose a base context in `for_RegisterAuthor/given/a_registration.cs` only when several contexts share the same arrangement.
3. Arrange the command in `Establish`. Invoke `Handle()` in `Because`. Name the `[Fact]` for the result a reader should expect.

## Check the event's name

`RegisterAuthor` and `AuthorRegistered` come from [the registration command](../cratis-arc-declare-command/SKILL.md) and [the recorded event](../cratis-chronicle-record-event/SKILL.md); `AuthorId` comes from [declaring domain values](../cratis-fundamentals-name-value/SKILL.md).

```csharp
using Cratis.Specifications;
using Library.Features.Authors;
using Library.Features.Authors.Registration;
using Xunit;

namespace Library.Specs.for_RegisterAuthor;

public class when_registering_an_author : Specification
{
    RegisterAuthor _command = null!;
    AuthorRegistered _event = null!;

    void Establish() => _command = new(AuthorId.New(), "Aster");
    void Because() => _event = _command.Handle();

    [Fact] public void should_return_the_submitted_name() => _event.Name.ShouldEqual("Aster");
}
```

## Avoid

- Don't perform a second action inside a fact; all facts observe the result of `Because`.
- Don't share mutable data between scenarios; each context arranges its own inputs in `Establish`.
- Direct invocation does not exercise generated-argument binding, authorization, validation or commitment.

## When it goes off the usual path

- **The decision uses time or a generated ID:** provide a fixed value through its actual input or generator seam. For values the pipeline supplies, configure them in a pipeline scenario instead. Don't sleep, assume today's date or compare two newly generated IDs.
- **The package is native TypeScript:** arrange a context, run one action and assert its outcome with the package's native runner; don't translate .NET attributes or lifecycle hooks literally.

## Related skills

- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md) to test the pipeline and recorded event.
