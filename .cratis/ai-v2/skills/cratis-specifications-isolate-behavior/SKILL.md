---
name: cratis-specifications-isolate-behavior
description: Specifies an isolated .NET decision with Cratis Specifications. Use when structuring a pure behavior spec, shared context or xUnit runner. Not for exercising the Arc pipeline (use cratis-specifications-exercise-backend).
compatibility: Requires the .NET SDK and the xUnit v3 specification runner.
---

# Test what RegisterAuthor.Handle returns

Call the registration handler once. Assert against the returned `AuthorRegistered`, without starting a host or appending to an event log.

1. Reference the Library project, `Cratis.Specifications.XUnit.v3` and `xunit.v3` in `Library.Specs`. Keep the core and adapter aligned; let the adapter register its framework.
2. Put one behavior context in `Library.Specs/for_RegisterAuthor/when_registering_an_author.cs`. Put reusable arrangement under `given/`.
3. Arrange the command in `Establish`. Invoke `Handle()` in `Because`. Name the `[Fact]` for the result a reader should expect.

## Check the event's name

`RegisterAuthor` and `AuthorRegistered` come from [delivering the registration slice](../cratis-platform-deliver-slice/SKILL.md); `AuthorId` comes from [declaring domain values](../cratis-fundamentals-name-value/SKILL.md).

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
- Don't share mutable data between scenarios; share only costly infrastructure and release owned resources in `Destroy`.
- Don't infer authorization, validation or an append from `Handle()` returning an event.

## Related skills

- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md) to test the pipeline and recorded event.
