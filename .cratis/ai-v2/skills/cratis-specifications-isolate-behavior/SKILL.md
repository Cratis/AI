---
name: cratis-specifications-isolate-behavior
description: Specifies an isolated .NET decision with Cratis Specifications. Use when structuring a pure behavior spec, shared context or xUnit runner. Not for exercising the Arc pipeline (use cratis-specifications-exercise-backend).
compatibility: Requires the .NET SDK and the xUnit v3 specification runner.
---

# Test what RegisterAuthor.Handle returns

Call the registration handler once. Assert against the returned `AuthorRegistered`, without starting a host or appending to an event log.

1. Reference the Library project, `Cratis.Specifications.XUnit.v3`, `xunit.v3`, `Microsoft.NET.Test.Sdk` and `xunit.runner.visualstudio` in `Library.Specs`. The Cratis xUnit adapter brings `Cratis.Specifications`; do not add a separate version.
2. Put one behavior context in `Library.Specs/for_RegisterAuthor/when_registering_an_author.cs`. If several contexts share arrangement, derive them from a base class in `for_RegisterAuthor/given/a_registration.cs`.
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
- Don't infer authorization, validation or an append from `Handle()` returning an event.

## Related skills

- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md) to test the pipeline and recorded event.
