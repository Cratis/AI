---
name: cratis-arc-command-validation
description: Add or change a rule on an existing Cratis Arc command — ConceptValidator<T> for a value invariant, CommandValidator<T> for command input, Provide() for a fetched precondition, and Result<TEvent, ValidationResult> for a state rule that must hold under concurrency. Use when a command must reject input or state. Do not use to define a new command, and do not use for append-time Chronicle constraints.
license: MIT
---

# Add validation to an Arc command

A rejection the user can act on is a **validation result**, never an exception.
Pick the mechanism by what the decision actually is, then put the rule where
that decision belongs.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Arc.Core` | `22.10.4` | `CommandValidator<T>`, `ConceptValidator<T>`, `ValidationResult`, read-model resolution |
| `Cratis.Fundamentals` | `7.18.2` | `Cratis.Monads.Result<TResult, TError>` |
| `Cratis.Chronicle` | `16.39.1` | `IReadModels.GetInstanceById<T>` |

Reverify before claiming support for another version.

## Choose the mechanism

| The decision is | Put it in |
| --- | --- |
| An invariant of a **value** — length, format, range | `ConceptValidator<T>` on the concept type |
| A rule about the command's **input** — required, cross-field, or a check against an injected dependency | `CommandValidator<TCommand>` |
| A **precondition that must be fetched** before the handler can build the event | `Provide()`, short-circuiting with `ValidationResult.Error(...)` |
| A **state rule that must hold under concurrency** | Read the state in `Handle()` and return `Result<TEvent, ValidationResult>` |
| Append-time **uniqueness** or an event-store constraint | Chronicle constraints — not this skill |
| A genuine fault: a bug, missing infrastructure, a broken dependency | Throw |

> **Never throw for a normal rejection.** A throw out of `Provide()` or
> `Handle()` becomes `HasExceptions` and HTTP 500, not a validation result.

## `ConceptValidator<T>` — the value's own rules

```csharp
using Cratis.Arc.Validation;

public class <ConceptName>Validator : ConceptValidator<<ConceptName>>
{
    public <ConceptName>Validator() =>
        RuleFor(_ => _.Value).NotEmpty().MaximumLength(<n>);
}
```

`ConceptValidator<T>` derives from `DiscoverableValidator<T>`, so it is found
automatically — no registration. Declaring the rule here makes it travel to
every command, query and nested model that carries the concept, and the proxy
generator projects it onto every property typed as that concept so the same rule
runs in the browser.

A failure raised by a concept validator is attributed to **the field holding the
concept**, not to the concept's inner `Value`.

⚠️ A query parameter declared as a raw `string`/`Guid` and converted to the
concept inside the method body **skips the concept's validator entirely** —
`ARC0015` reports it. Declare the parameter as the concept.

## `CommandValidator<T>` — the command's own rules

```csharp
using Cratis.Arc.Commands;

public class <CommandName>Validator : CommandValidator<<CommandName>>
{
    public <CommandName>Validator() =>
        RuleFor(_ => _.<Property>)
            .GreaterThan(0)
            .WithMessage("<message>");
}
```

- Derive from `CommandValidator<T>`, not `AbstractValidator<T>` — that is what
  makes it discoverable and extractable.
- Omit the validator entirely when there are no rules.
- Keep single-property intrinsic rules on the concept instead, so they are not
  restated per command.
- `BaseValidator<T>` also gives `WhenCommand(...)` and `WhenQuery(...)` for a
  model validated in both directions.

Constructor dependencies are injected. A read model injected here resolves by
**the command's resolved key** — see the existence rules below.

⚠️ `ARC0013` warns when a rule dereferences a possibly-null concept member. A
validator that throws while validating hostile or partial input does not become
a 500: the invoker catches it and substitutes a single result with reason
`ValidatorFailed`, replacing every message the validator's author wrote. That is
a silent loss of all your messages — fix the dereference rather than relying on
the catch.

## `Provide()` — a fetched precondition

```csharp
public async Task<Result<<Other>, ValidationResult>> Provide(IReadModels readModels)
{
    var other = await readModels.GetInstanceById<<Other>>((EventSourceId)<OtherId>);
    return other is null
        ? ValidationResult.Error("<message>")
        : other;
}

public <EventType> Handle(<Other> other) => new(other.<Property>);
```

`Provide` runs after authorization and validation and before `Handle`. Every
value it returns must be consumed by a `Handle` parameter (`ARC0005`);
`ValidationResult`, `AuthorizationResult` and `CommandResult` are exempt because
they short-circuit instead.

Use this shape whenever the read model is keyed by **anything other than the
command's own resolved key** — a referenced other entity, or one of several
candidate ids.

## `Result<TEvent, ValidationResult>` — a state rule under concurrency

```csharp
public Result<<EventType>, ValidationResult> Handle(<ReadModel> current) =>
    current.<Count> >= <Limit>
        ? ValidationResult.Error("<message>")
        : new <EventType>(<args>);
```

`Cratis.Monads.Result<TResult, TError>` has implicit conversions in both
directions, so both branches compile without an explicit wrap. The pipeline
unwraps it: success is appended, failure becomes a validation failure.

This is the shape to use when the rule reads state the command is about to
change. It does **not** by itself make the decision atomic — an append-time
Chronicle constraint is what enforces uniqueness and concurrency at the store.
Use both when the rule must hold under a race.

## Read-model existence — get this right

A read model injected into a validator, `Provide()`, or `Handle()` resolves
**only by the command's resolved key**. It is not resolved by the read-model
type, and not by "the property that looks like its key". If the instance you
need is keyed by anything else, direct injection hands you the wrong instance or
nothing at all — a correctness bug, not a compile error.

The parameter's nullability is the required/optional switch:

| Parameter | No instance for the command's key |
| --- | --- |
| `TReadModel?` | `null` is injected — guard with `is null` |
| `TReadModel` | Rejected, not crashed: a **registered** read model with a usable resolved key raises `ReadModelDoesNotExistForCommand`, which carries `IValidationFailure` and surfaces as a validation failure (HTTP 400) with reason `DependencyUnavailable` and a message that does not name the type |

Only when the dependency is *not* a registered read model, or no usable key was
resolved, does it fall through to the default server-fault path —
`CannotResolveCommandDependency` for a handler parameter,
`CannotResolveValidatorDependency` for a validator constructor parameter.

⚠️ **`null` is not always what an absent instance looks like.** Chronicle's
`GetInstanceById<T>` is declared as a non-nullable `Task<TReadModel>` yet hands
back `default!`, so the compiler warns about nothing. A materialized projection
or reducer answers `null` both when the instance was never created and after a
`[RemovedWith<T>]` removal. A `[Passive]` **projection that was never created**
is the exception: Chronicle computes it on demand and seeds the initial state
from the read model schema, so it resolves to a **fully default-valued
instance**, never `null`. Neither the `is null` guard nor the non-nullable
"must exist" switch fires there.

This is invisible when a status enum's `0` is a real state: absent becomes
byte-identical to freshly created. Carry an explicit existence flag on the read
model — one `[SetValue<TEvent>(true)] bool Exists` per event that can be the
first for the stream — and check that instead of nullability. Renumbering the
enum from `1` is not a fix; the value is then dropped from the payload and
deserializes back to `0` on the client anyway.

Write your own by-id accessors as `Task<T?>` so callers get the compiler signal
Chronicle's own signature withholds.

⚠️ A spec suite will not catch this on its own: the command scenario harness
answers `null` for an unseeded key, which matches production for every case
*except* the passive projection. Cover the absent case by seeding a
default-valued instance explicitly, not only `null`.

`ARC0006` warns when a read-model parameter is non-nullable, precisely because a
command-scoped read model can be missing. Make it nullable when absence is part
of the command's valid behavior; keep it non-nullable when absence really is a
rejection.

## Severity

`ValidationResult.Information`, `.Warning` and `.Error` all exist.
`ValidationResultSeverity` is `Unknown = 0`, `Information = 1`, `Warning = 2`,
`Error = 3`. By default only `Error` blocks execution and everything below it is
filtered off the result entirely. A caller that wants warnings to be visible but
non-blocking passes an `allowedSeverity` — anything strictly greater than it
blocks.

Set `Reason` and `ReasonDetail` when the rejection has an identity a client
should branch on. Callers should read `ReasonDetail`, not `Message`.

## Route near misses

- Defining a new command or choosing its return shape: `cratis-arc-command`.
- Executing an existing command from backend code: `cratis-arc-command-execution`.
- Append-time uniqueness, `[Unique]`, `IConstraint`, or a `RemovedWith` release:
  the Chronicle event constraints guidance.
- Choosing or shaping the concept itself: `cratis-fundamentals-concept`.

## Verify

- Every user-facing rejection is a validation result; nothing throws for it.
- Single-value invariants live on `ConceptValidator<T>`, not restated per command.
- Query parameters are declared as their concept, so the concept validator runs.
- The validator derives from `CommandValidator<T>` and is not registered by hand.
- A read model injected directly is genuinely keyed by the command's own key;
  anything else is read explicitly in `Provide()`.
- Read-model parameters are nullable exactly when absence is valid.
- Existence is checked with a flag rather than `null` wherever a `[Passive]`
  projection is involved.
- A concurrency-sensitive rule is paired with the append-time constraint that
  actually enforces it.
- The failure case has a specification asserting both that the command was
  rejected *and* which rule rejected it.
- `dotnet build` is clean in Debug and Release, with `ARC0005`, `ARC0006`,
  `ARC0013` and `ARC0015` silent or explicitly justified.
