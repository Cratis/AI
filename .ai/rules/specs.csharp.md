---
applyTo: "**/for_*/**/*.cs, **/when_*/**/*.cs"
paths:
  - "**/for_*/**/*.cs"
  - "**/when_*/**/*.cs"
---

# How to Write C# Specs

Extends the base [specs.md](./specs.md) (folder structure, naming, philosophy) with C#-specific conventions. Specs are **mandatory for every slice type**, including reactors.

`Cratis.Specifications` keeps the approach of Machine.Specifications (MSpec): `Establish → Because → should_` maps to "Given → When → Then" and keeps each spec focused on *one setup, one action, one set of assertions*.

## Frameworks

- [xUnit](https://xunit.net/) for execution.
- [Cratis.Specifications](https://github.com/Cratis/Specifications) for BDD specification by example — the `Specification` base class discovers `Establish`/`Because`/`Destroy` by convention (no attributes).
- [NSubstitute](https://nsubstitute.github.io/) for mocking collaborators.
- Spec projects are named `<Source>.Specs`.

## BDD pattern

`Establish` sets up the world, `Because` performs the single action under test, `should_*` facts verify individual outcomes. Any method can be `async Task`.

```csharp
public class when_combining_parts : Specification
{
    object[] _parts;
    string _result;

    void Establish() => _parts = ["First", "Second", "Third"];
    void Because() => _result = KeyHelper.Combine(_parts);

    [Fact] void should_combine_all_parts() => _result.ShouldEqual("First+Second+Third");
}
```

| Method | Purpose | Notes |
|---|---|---|
| `void Establish()` | setup, before `Because()` | each class in the chain has its own, run base-first — never call `base.Establish()` |
| `void Because()` | the single action under test | only in concrete spec files, never in a reusable context |
| `[Fact] void should_*()` | one assertion per fact | use the `ShouldXxx()` extension methods |
| `void Destroy()` | teardown after each test | |

## Lead with the in-process scenario family

For Cratis application behavior, prefer the four in-process scenario helpers over full out-of-process Chronicle host specs. They target different concerns and are additive.

| Tool | Tests | Use when |
|---|---|---|
| `Specification` (unit) | an isolated class with mocked collaborators | pure function / injected services to mock |
| `CommandScenario<TCommand>` | the real Arc command pipeline — authorization + validators + `Provide()` + `Handle()` + appended events | **default for State Change slices** |
| `EventScenario` | Chronicle-level append semantics, no command pipeline | constraint violations, raw stream sequencing/concurrency |
| `ReadModelScenario<TReadModel>` | projection/reducer state from a sequence of events (auto-detects model-bound / fluent / reducer) | **default for State View slices** |
| `ReactorScenario<TReactor>` | reactor handler invocation + side effects via mocked services | Automation / Translation slices |

> **Out-of-process Chronicle integration specs are an advanced case** — reserve them for host wiring, real infrastructure, serialization/transport, or end-to-end boundaries the scenario helpers can't exercise. They are not the default vertical-slice test shape.

**Every spec file is wrapped in `#if DEBUG … #endif`** so spec code ships only in Debug (the Debug build gate validates it; the Release build regenerates proxies).

### `CommandScenario<TCommand>` — State Change default

Runs authorization, validators, `Provide()` (when present), and `Handle()` in-process, and exposes the appended events.

```csharp
#if DEBUG
namespace MyApp.Authors.Registration.when_registering_an_author;

public class and_all_information_is_valid : Specification
{
    readonly CommandScenario<RegisterAuthor> _scenario = new();
    readonly AuthorId _id = AuthorId.New();
    CommandResult _result;

    async Task Because() => _result = await _scenario.Execute(new RegisterAuthor(_id, "Jane Austen"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] async Task should_have_appended_registered_event() =>
        await _scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(_id, e => e.Name == "Jane Austen");
}
#endif
```

- `CommandScenario<TCommand>` exposes `Services` (an `IServiceCollection`), `Context`, `Execute(command)`, and `Validate(command)` — and nothing else; everything else is configured through `Services` and asserted with extension methods.
- **Event assertions are extension methods on the scenario** (from the Chronicle testing package), keyed by **command + event** type: `await _scenario.ShouldHaveAppendedEvent<TCommand, TEvent>(eventSourceId)` or the `(eventSourceId, Func<TEvent,bool> predicate)` overload; plus `await _scenario.ShouldHaveTailSequenceNumber<TCommand>(...)`. They return `Task`, so the fact is `async Task`.
- **`CommandResult` assertions** (Arc extensions): `ShouldBeSuccessful()`, `ShouldNotBeSuccessful()`, `ShouldBeValid()`, `ShouldHaveValidationErrors()`, `ShouldHaveValidationErrorFor(message)`, `ShouldBeAuthorized()`, `ShouldNotBeAuthorized()`, `ShouldHaveExceptions()`/`ShouldNotHaveExceptions()`.
- **Seed prior state through `_scenario.Services`** — there is no `Given`/`Events` on `CommandScenario`. To populate the DCB read models the validator/`Provide()`/`Handle()` inject, substitute `IReadModels` and register it (`_scenario.Services.Replace(new ServiceDescriptor(typeof(IReadModels), mock))`, mocking `GetInstanceById(...)`) or register projections with `_scenario.Services.AddReadModels(...)`.
- **Validator/`Provide()` dependencies:** register them in `_scenario.Services`; Arc testing discovers the concrete validator automatically. When several specs need different injected validator states, test rejected variants by instantiating the validator directly (per-scenario state can be order-sensitive under parallel xUnit).
- **`Provide()`:** drive it through `CommandScenario` end-to-end; when the handler's decision is pure given provided data, also test `Handle(providedValue)` directly.

#### Validation-failure assertions — non-negotiable

Every unhappy-path spec asserts **both**:

```csharp
[Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
[Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
```

`ShouldNotBeSuccessful()` alone can't tell a validation rejection from an unhandled exception. **Never assert on message strings** — they're presentation text. Authorization failures use `ShouldNotBeAuthorized()` (an unauthorized result has *no* validation errors, so `ShouldHaveValidationErrors()` would silently flip). To exercise a command that carries authorization attributes, register the identity the authorization evaluator reads into `_scenario.Services` (substitute the identity provider your app uses). **Adding `[Roles]` to an existing command breaks its happy-path AND validation-failure `.Execute()` specs** — an unauthorized result is not successful and carries no validation errors; switch those assertions to `ShouldNotBeAuthorized()`.

`CommandResult` assertions (from `Cratis.Arc.Testing.Commands`; failures throw `CommandResultAssertionException`): `ShouldBeSuccessful()` (`isAuthorized && isValid && !hasExceptions`), `ShouldNotBeSuccessful()`, `ShouldBeValid()` (no validation errors — does *not* check authz/exceptions), `ShouldHaveValidationErrors()`, `ShouldHaveValidationErrorFor(message)`, `ShouldBeAuthorized()`, `ShouldNotBeAuthorized()`, `ShouldHaveExceptions()`.

> **Validator-state order-sensitivity:** the command-scenario pipeline can cache enough state to make injected-validator branches order-sensitive when xUnit runs classes in parallel. Use `CommandScenario` for the valid path, test rejected state-variants by **instantiating the validator directly**, and — only for that validator-state case — put the command's specs in a **small xUnit `[Collection]`**. (This is distinct from the unique-value-collision rule below, where `[Collection]` is the *wrong* fix.)

### `EventScenario` — constraints & append semantics

```csharp
readonly EventScenario _scenario = new();
IAppendResult _result;

async Task Establish() =>
    await _scenario.Given.ForEventSource(AuthorId.New()).Events(new AuthorRegistered("Jane Austen"));

async Task Because() =>
    _result = await _scenario.EventLog.Append(AuthorId.New(), new AuthorRegistered("Jane Austen"));

[Fact] void should_be_failed() => _result.ShouldBeFailed();
[Fact] void should_violate_unique_constraint() => _result.ShouldHaveConstraintViolationFor(AuthorConstraintNames.UniqueName);
```

`IAppendResult` assertions (failures throw `AppendResultAssertionException`): `ShouldBeSuccessful()`, `ShouldBeFailed()`, `ShouldHaveConstraintViolations()`/`ShouldNotHave…`, `ShouldHaveConstraintViolationFor(name)`, `ShouldHaveConcurrencyViolations()`/`ShouldNotHave…`, `ShouldHaveErrors()`/`ShouldNotHave…`. Assert the constraint **name**, never the message.

### `ReadModelScenario<TReadModel>` — State View default

Drives events into the projection/reducer and asserts the resulting state. Use xUnit `Assert.*` on `_scenario.Instance`.

```csharp
ReadModelScenario<Author> _scenario = null!;
void Establish() => _scenario = new();

async Task Because() =>
    await _scenario.Given.ForEventSource(_id).Events(new AuthorRegistered("Jane Austen"), new AuthorArchived());

[Fact] void should_be_archived() => Assert.True(_scenario.Instance!.IsArchived);
```

Use the named-parameter constructor when services/initial state are needed: `new ReadModelScenario<Author>(initialState: null, serviceProvider: services)`. Pre-seed a keyed read model with `Given.ForEventSourceId(id).ReadModel(instance)` for code that calls `IReadModels.GetInstanceById`. Cross-stream projections (`UsingKey`/`UsingParentKey`) are supported — seed each contributing stream with its own `Given.ForEventSource(...)`.

**Bridging `IReadModels` into a `CommandScenario`** (current harness limitation): when a command handler injects `IReadModels` directly, build a focused `ReadModelScenario<T>`, seed it via `Given.ForEventSourceId(id).ReadModel(...)`, then register its read models into the command scenario — `_scenario.Services.AddSingleton(readModelScenario.ReadModels)`. Pass `scenario.ReadModels` into code under test for keyed `GetInstanceById` reads; for non-key searches/filters, register a fake lookup or an `IMongoCollection<T>` mock in the scenario services instead.

**Skip discipline:** don't pre-emptively `[Fact(Skip=...)]` a read-model assertion — assume scalar `ConceptAs<string>`, enum, and identifier properties populate correctly; if one fails, investigate the projection. Only skip on a *reproduced* harness gap, and put the specific reason in the skip message.

### `ReactorScenario<TReactor>` — Automation / Translation

Construct with an `IServiceProvider` of NSubstitute mocks; assert on the mocks after `Given` fires events. Import `Cratis.Chronicle.Testing.Reactors;`.

```csharp
void Establish()
{
    _service = Substitute.For<IMyService>();
    _scenario = new(new ServiceCollection().AddSingleton(_service).BuildServiceProvider());
}
async Task Because() => await _scenario.Given.ForEventSource(_id).Events(new AuthorRegistered("Jane Austen"));
[Fact] async Task should_notify() => await _service.Received(1).Notify("Jane Austen");
```

## Out-of-process Chronicle integration specs (advanced)

Reserve these for the host/transport boundary the scenario helpers can't reach. They test a complete slice — HTTP request → command → append → constraint → projection — against a real Chronicle store, and live under `when_<behavior>/` directly inside the slice folder (no `for_` folder; the "unit" is the whole slice).

```csharp
using context = MyApp.Authors.Registration.when_registering.and_name_already_exists.context;

namespace MyApp.Authors.Registration.when_registering;

[Collection(ChronicleCollection.Name)]
public class and_name_already_exists(context context) : Given<context>(context)
{
    public class context(ChronicleOutOfProcessFixture fixture) : given.an_http_client(fixture)
    {
        public const string AuthorName = "John Doe";
        public CommandResult<object>? Result;

        async Task Establish() => await EventStore.EventLog.Append(AuthorId.New(), new AuthorRegistered(AuthorName));
        async Task Because() => Result = await Client.ExecuteCommand<RegisterAuthor>("/api/authors/register", new RegisterAuthor(AuthorName));
    }

    [Fact] void should_not_be_successful() => Context.Result!.IsSuccess.ShouldBeFalse();
    [Fact] void should_have_appended_only_one_event() => Context.ShouldHaveTailSequenceNumber(EventSequenceNumber.First);
}
```

- `ExecuteCommand<TCommand>(url, cmd)` returns `CommandResult<object>?`; `ExecuteCommand<TCommand, TResult>(url, cmd)` returns `CommandResult<TResult>?`.
- Helpers: `Context.ShouldHaveTailSequenceNumber(n)` (First = 0), `Context.ShouldHaveAppendedEvent<TEvent>(seq, eventSourceId, validator)`.

**Async reactor follow-ups** — when a reactor fires after the command and appends further events, collect them: start the collector **before** the triggering act with `_collector = StartCollectingAppends()`, then `await _collector.WaitForCount(2, TimeSpan.FromSeconds(10))`, assert via `_collector.ShouldHaveEvent<TEvent>(e => ...)`, and `_collector.Dispose()` in `Destroy()`. (`IEventAppendCollection` from the Chronicle testing API.)

## Reusable layered contexts

Layered contexts (`all_dependencies → a_<sut> → when_*`) capture shared setup base-first: the base mocks dependencies, the next builds the system under test, each spec adds only what's unique.

```csharp
// given/all_dependencies.cs — mocks all deps
public class all_dependencies : Specification
{
    protected IEventStore _eventStore;
    void Establish() => _eventStore = Substitute.For<IEventStore>();
}

// given/a_reactor_handler.cs — builds the system under test
public class a_reactor_handler : all_dependencies
{
    protected ReactorHandler _handler;
    void Establish() => _handler = new(_eventStore);
}
```

Put the action under test only in the concrete spec's `Because()`, never in a reusable context.

## NSubstitute patterns

```csharp
_service.GetValue(Arg.Any<string>()).Returns("result");
Arg.Is<Request>(r => r.Id == expectedId)            // matcher
_service.Received(1).DoSomething(Arg.Any<string>()); // verify
_service.DidNotReceive().DoSomethingElse(Arg.Any<int>());
_handler.Handle(Arg.Any<CommandContext>()).Throws(new Exception("fail"));
```

Catch exceptions for a unit under test with `Catch.Exception`:

```csharp
async Task Because() => _error = await Catch.Exception(_sut.DoSomething);
[Fact] void should_not_fail() => _error.ShouldBeNull();
```

## Assertion extension methods

From `Cratis.Specifications`: `.ShouldEqual(expected)`, `.ShouldBeTrue()`, `.ShouldBeFalse()`, `.ShouldBeNull()`, `.ShouldNotBeNull()`, `.ShouldBeEmpty()`, `.ShouldNotBeEmpty()`, `.ShouldContain(item)`, `.ShouldNotContain(item)`, `.ShouldContainOnly(items)`, `.ShouldBeOfExactType<T>()`, `.ShouldBeGreaterThan(n)`, `.ShouldBeLessThan(n)`.

## Conventions

- **Per-test values for anything in a uniqueness check** — `$"{Guid.NewGuid():N}@example.com"`, a fresh `Guid`, or a truncated id `Guid.NewGuid().ToString("N")[..9]`. Hardcoded values cause order-dependent flakes. Do not add `[Collection(...)]` to work around *collisions* (it's the wrong fix here).
- **Sequence numbers are zero-based** — first event = `0`, tail of two events = `1`, tail of three = `2`. Never write "tail of 1" for a single appended event; the tail of `[A]` is `0`. (A common first-pass defect.)
- Common usings come from `GlobalUsings.Specs.cs` (`Xunit`, `NSubstitute`, `Cratis.Specifications`, …) — don't duplicate them, and don't add a using for the system-under-test namespace.
- **`using` ordering (SA1210/SA1211):** non-aliased namespaces first, then a blank line, then `using <alias> = …` aliases sorted by alias name. Alias a command whose short name collides with a namespace segment (CS0118) — `using RegisterAuthorCmd = …` style, with a domain-meaningful alias, never a technical `Command`/`Event`/`Component` suffix.
- Single-statement assertion lambdas use expression-body form (RCS1021) — `[Fact] void should_x() => result.ShouldEqual(...)`, not a `{ … }` block. Don't break long `should_` lines; don't add blank lines between `should_` methods.
- A slice covering **multiple subjects** (several read models/constraints/aspects) groups its specs under `<Slice>/for_<Subject>/when_<behavior>/`.

## What NOT to spec

Simple properties are compiler-verified. Save spec effort for business logic, coordination between dependencies, and complex transformations.

```csharp
// ❌ Do NOT spec these
public string TableName => tableName;                         // returns constructor parameter
public IEnumerable<Property> Properties => mapper.Properties; // simple delegation

// ✅ Spec complex business logic
public decimal TotalCost => Items.Sum(i => i.Cost * i.Quantity * (1 + i.TaxRate));
```

Also don't spec logging or trivial getters.

## See also

- [specs.md](./specs.md) — folder structure, naming, BDD philosophy (the base this extends).
- [efcore.specs.md](./efcore.specs.md) — `DbContext` specs with SQLite in-memory.
- [vertical-slices.md](./vertical-slices.md) — what each artifact promises (the contract under spec).
- [frontend-testing.md](./frontend-testing.md) — TypeScript/React application BDD specs.
- skills: **write-specs**, **write-specs-events**, **write-specs-readmodels**.
