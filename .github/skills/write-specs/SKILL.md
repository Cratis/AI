---
name: write-specs
description: Use this skill when asked to write tests, specs, or test coverage for a command, query, or slice in a Cratis-based project. Produces BDD-style integration specs using xUnit and Cratis.Specifications.
---

Write comprehensive BDD integration specs for a vertical slice command or query.

## Spec placement

Specs live **in the same slice folder** as the `.cs` file:

```
Features/<Feature>/<Slice>/
├── <Slice>.cs
└── when_<verb_phrase>/
    ├── and_<happy_scenario>.cs
    └── and_<failure_scenario>.cs
```

## What to cover for every State Change command

Write one spec class for **each** of:

1. **Happy path** — command succeeds, expected event is appended, sequence number advanced
2. **Each validation failure** — one `and_` class per `[Required]`, `[MaxLength]`, etc. rule
3. **Each business rule violation** — one `and_` class per `RulesFor<,>` condition
4. **Each constraint violation** — one `and_` class per `IConstraint`

## C# spec structure

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands;
using context = <NamespaceRoot>.<Feature>.<Slice>.when_<behavior>.and_<scenario>.context;

namespace <NamespaceRoot>.<Feature>.<Slice>.when_<behavior>;

[Collection(ChronicleCollection.Name)]
public class and_<scenario>(context context) : Given<context>(context)
{
    public class context(ChronicleOutOfProcessFixture fixture) : given.an_http_client(fixture)
    {
        public CommandResult<Guid> Result;

        async Task Because()
        {
            Result = await Client.ExecuteCommand<MyCommand, Guid>(
                "/api/<feature>/<action>",
                new MyCommand(...));
        }
    }

    [Fact] void should_<expected_result>() => Context.Result.IsSuccess.ShouldBeTrue();
}
```

For scenarios that require pre-existing state, add an `Establish()` method before `Because()`:

```csharp
Task Establish() =>
    EventStore.EventLog.Append(SomeId.New(), new SomeEvent(...));
```

## Naming conventions

- Folder: `when_<verb_phrase>` — e.g. `when_registering`, `when_removing_a_project`
- File: `and_<condition>.cs` — e.g. `and_name_is_unique.cs`, `and_name_already_exists.cs`
- Test method: `should_<expected_result>` — e.g. `should_append_the_registered_event`

## Assertion helpers

Use Cratis.Specifications helpers — never raw `Assert.*`:
- `Context.Result.IsSuccess.ShouldBeTrue()`
- `Context.Result.IsSuccess.ShouldBeFalse()`
- `Context.ShouldHaveAppendedEvent<MyEvent>()`
- `Context.ShouldHaveTailSequenceNumber(EventSequenceNumber.First)`

## After writing

Run `dotnet test`. Fix all failures before completing.
