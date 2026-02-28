# Spec Examples

## Happy path spec

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands;
using Cratis.Chronicle.Events;
using context = MyApp.Projects.Registration.when_registering.and_name_is_unique.context;

namespace MyApp.Projects.Registration.when_registering;

[Collection(ChronicleCollection.Name)]
public class and_name_is_unique(context context) : Given<context>(context)
{
    public class context(ChronicleOutOfProcessFixture fixture) : given.an_http_client(fixture)
    {
        public CommandResult<Guid> Result;

        async Task Because()
        {
            Result = await Client.ExecuteCommand<RegisterProject, Guid>(
                "/api/projects/register",
                new RegisterProject("My Project"));
        }
    }

    [Fact] void should_succeed() => Context.Result.IsSuccess.ShouldBeTrue();
    [Fact] void should_have_appended_an_event() => Context.ShouldHaveAppendedEvent<ProjectRegistered>();
}
```

---

## Business rule violation spec (pre-existing state)

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands;
using Cratis.Chronicle.Events;
using context = MyApp.Projects.Registration.when_registering.and_name_already_exists.context;

namespace MyApp.Projects.Registration.when_registering;

[Collection(ChronicleCollection.Name)]
public class and_name_already_exists(context context) : Given<context>(context)
{
    public class context(ChronicleOutOfProcessFixture fixture) : given.an_http_client(fixture)
    {
        public const string ProjectName = "My Project";
        public CommandResult<Guid> Result;

        Task Establish() =>
            EventStore.EventLog.Append(ProjectId.New(), new ProjectRegistered(ProjectId.New(), ProjectName));

        async Task Because()
        {
            Result = await Client.ExecuteCommand<RegisterProject, Guid>(
                "/api/projects/register",
                new RegisterProject(ProjectName));
        }
    }

    [Fact] void should_not_succeed() => Context.Result.IsSuccess.ShouldBeFalse();
    [Fact] void should_not_append_a_second_event() =>
        Context.ShouldHaveTailSequenceNumber(EventSequenceNumber.First);
}
```

---

## Validation failure spec (model validation)

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands;
using context = MyApp.Projects.Registration.when_registering.and_name_is_empty.context;

namespace MyApp.Projects.Registration.when_registering;

[Collection(ChronicleCollection.Name)]
public class and_name_is_empty(context context) : Given<context>(context)
{
    public class context(ChronicleOutOfProcessFixture fixture) : given.an_http_client(fixture)
    {
        public CommandResult<Guid> Result;

        async Task Because()
        {
            Result = await Client.ExecuteCommand<RegisterProject, Guid>(
                "/api/projects/register",
                new RegisterProject(string.Empty));
        }
    }

    [Fact] void should_not_succeed() => Context.Result.IsSuccess.ShouldBeFalse();
    [Fact] void should_report_validation_error() =>
        Context.Result.ValidationResults.ShouldContainValidationError(nameof(RegisterProject.Name));
}
```

---

## Constraint violation spec

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands;
using context = MyApp.Projects.Registration.when_registering.and_constraint_is_violated.context;

namespace MyApp.Projects.Registration.when_registering;

[Collection(ChronicleCollection.Name)]
public class and_constraint_is_violated(context context) : Given<context>(context)
{
    public class context(ChronicleOutOfProcessFixture fixture) : given.an_http_client(fixture)
    {
        public CommandResult<Guid> Result;

        Task Establish() =>
            EventStore.EventLog.Append(ProjectId.New(), new ProjectRegistered(ProjectId.New(), "Taken Name"));

        async Task Because()
        {
            // Same event-source key — triggers the uniqueness constraint
            Result = await Client.ExecuteCommand<RegisterProject, Guid>(
                "/api/projects/register",
                new RegisterProject("Taken Name"));
        }
    }

    [Fact] void should_not_succeed() => Context.Result.IsSuccess.ShouldBeFalse();
    [Fact] void should_report_constraint_violation() =>
        Context.Result.ExceptionMessages.ShouldContain(m => m.Contains("constraint"));
}
```

---

## Assertion helpers reference

| Helper | When to use |
|--------|-------------|
| `.ShouldBeTrue()` / `.ShouldBeFalse()` | Boolean assertions |
| `.ShouldEqual(x)` | Value equality |
| `Context.ShouldHaveAppendedEvent<T>()` | Confirm an event of type T was appended |
| `Context.ShouldHaveTailSequenceNumber(n)` | Confirm the sequence number (use to check no extra events were appended) |
| `.ShouldContainValidationError(field)` | Confirm model validation rejected a specific field |
| `EventSequenceNumber.First` | Sequence number 0 — the very first event; use to check exactly one event in the log |
