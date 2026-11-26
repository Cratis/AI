---
name: cratis-specifications-isolate-behavior
description: Use when specifying pure behavior, fixture structure or the .NET spec runner. Not for proving Arc pipeline behavior (cratis-specifications-exercise-backend).
---

# Specify one decision without a host

1. Pick a decision whose result depends entirely on supplied values. Write the expected observation as a `should_` name and its circumstance as a `when_` name. **Done:** the assertion can fail without HTTP, a store, a clock read or a UI. If the question is whether validation prevented a write, hand the rejection scenario to `cratis-specifications-exercise-backend` instead.
2. In an xUnit v3 spec project referencing `Cratis.Specifications.XUnit.v3`, derive the context from `Specification`. Arrange in `Establish`, act once in `Because`, observe in `[Fact]` methods. Read references/shared-contexts.md when several contexts need the same setup. **Done:** assertions observe captured output rather than rerunning the decision.

```csharp
using Cratis.Specifications;
using Xunit;

public class when_accepting_a_padded_display_name : Specification
{
    string _input = string.Empty;
    string _accepted = string.Empty;

    void Establish() => _input = " Aster ";
    void Because() => _accepted = DisplayName.Accept(_input);

    [Fact] public void should_keep_only_the_significant_text() => Assert.Equal("Aster", _accepted);
}

public static class DisplayName
{
    public static string Accept(string text) => text.Trim();
}
```

3. From the example run `dotnet build Specs --configuration Release -warnaserror`, then `dotnet test Specs --configuration Release --no-build --logger "console;verbosity=detailed"`. **Done:** `should_keep_only_the_significant_text` executed and passed. Read references/xunit-discovery.md if the build passes but the named test is absent.
