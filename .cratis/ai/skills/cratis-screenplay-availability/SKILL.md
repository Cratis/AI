---
name: cratis-screenplay-availability
description: Use when a Screenplay model must decide whether a module, feature or slice exists for a tenant, user or system, or when it provides ambient `$context` values. Not for who may act.
license: MIT
---

# Availability, audiences and context values

Run the examples with the compiler version the application uses before relying on them.

## Pick the right mechanism

| Question | Use |
| --- | --- |
| Is this part there at all for this tenant, user or system (a package, a rollout, an incident switch)? | `audience`, `availability`, `available` |
| May this caller do it, given who they are and what they can prove? | `policy` and `authorize`; use [cratis-screenplay-model-interaction](../cratis-screenplay-model-interaction/SKILL.md) |
| Is this input acceptable? | `rule` and validation on the command |
| Does a gate or code need a value that is not in the request (the vessel viewed, the project worked in)? | `provide` and `$context.<name>` |
| Which tenant-level commercial module is bought? | Box Office module entitlements; outside the model |

Availability is decided **before** `authorize`. A part that is not available is refused as
`NotAvailable`, which a client can tell apart from not allowed, so it can hide an entry or
explain the package. Do not model a package, rollout or kill switch as a policy, and do not
model a role check as an audience.

## The forms

```screenplay excerpt
audience Plus
  description "Customers on the Plus commercial package"

audience Preview
  description "Tenants taking part in the preview"

availability DataQuality
  description "Sold with Plus, once the vessel has reported"
  for Plus
  when $context.vessel.hasReported == true

module Fleet
  feature DataQuality
    available with DataQuality

    slice StateView QualityScores
      available for Plus or Preview
```

- `audience <Name>` is a named group with a `description` and nothing else. The model
  never says who is in it; membership is granted at runtime, so nothing ships as an accidental entitlement.
- `availability <Name>` is a reusable rule. Its `for`, `when` and `with` lines must all hold;
  `with` builds on another availability. A `with` cycle is PLAY1137.
- `available for <audiences>`, `available when <condition>`, `available with <Availability>`.
  `for` and `with` combine names with `and`, `or`, `not` and parentheses (see [`not`](#not-and-the-closing-pattern)). A `when` is one condition with its own
  `and`/`or`. One line holds one form; to mix forms, name them in an `availability` and use `with`.
  Several `available` lines on one construct all have to hold.
- A gate is allowed on a module, feature, slice, command, query, screen, and on a screen `action` or `data`
  element (see [screen elements](#screen-elements)). Gates AND down the
  path from module to construct. Gate at the highest level that is true for everything beneath it.
- The runtime context carries `$context.audiences`, the union of the tenant's, user's and
  system caller's audiences. Withdrawing a grant removes it from its own level only.

## `not` and the closing pattern

`not` is an audience term: `available for Plus and not Incident` and `available for not Incident`, also on the
`for` line of an `availability` block. `not` binds tighter than `and`, then `or`, and applies to **one audience name**.

- It is three-valued. `not` of an unknown audience is unknown, so the part stays closed (**unknown never opens a gate**).
  A part is closed for a *granted* audience: grant an `Incident` audience to close it, withdraw the grant to reopen it.
  Do not list every other audience to simulate a negation.
- `PLAY1171` (error): `not` on a group (`not (Plus)`), on another `not`, on nothing, or on an availability in
  `available with` (`with not Open`).
- `PLAY1139` skips any gate that contains `not`, as it skips `when`: it depends on grants the model cannot see.
- A negated audience is ESM v58 (`"negated": true` on the audience requirement). A model without `not` keeps its earlier version.

## Screen elements

An element bound to a command or a query is offered only when the part is available and the caller is authorized.
That is **derived**; write nothing for it. The path is suspension first, then the module, feature, slice and construct
gates, then `authorize`.

- `available for | when | with` is allowed under a screen `action` (plain, not guarded) and a screen `data` directive,
  one form per line. Elements with nothing bound (section, table, summary, component) take no gate.
- **An element gate can only narrow.** It is added to the derived path. `PLAY1172` (warning) reports a gate that can be on
  while the bound part is not; narrow or remove it.
- Availability of an element is asked with the data the screen shows (for example the one vessel), not only the tenant and user.
- An element gate is ESM v59 (`"available"` on a screen `data` entry and `action`, written only when present).
- The reference evaluator reports everything available unless `SemanticScreenAvailability.Evaluate` is given a
  `SemanticAvailabilityState` (audiences and suspended parts). A result carries a `Cause`: `NotAuthorized`,
  `NotAvailable` or `Suspended`. `when` conditions stay undecided there. Specifications still run with everything available.

## Suspension

An operator can suspend any module, feature, slice or part (command, read model) for a tenant, a user or the system,
and resume it. **The model declares nothing for this**; do not add an audience or a flag to simulate it.

- The reason is `Suspended`, distinct from `NotAvailable` (same 403; clients tell them apart by reason).
- It is checked **first**, before gates (so before audiences and context values resolve) and before `authorize`.
  A suspension at any level wins over every grant (deny wins); suspending a module or feature suspends what is beneath it.
- Levels are tenant, user and system; the newest decision per level and path wins, so a later resume ends an earlier
  suspension at the same level only.
- **Two pairs of verbs, kept apart:** audiences are **granted and withdrawn**; parts are **suspended and resumed**.
  The events are `PartSuspended` and `PartResumed`. Never name one `TenantSuspended`; that belongs to another product.

## Rules the language holds

- **Unknown never opens a gate.** A missing audience, a missing value, an unresolved condition or an
  undecided result leaves the part unavailable. An undeclared audience or availability is a warning
  (PLAY1135, PLAY1136), not an error, and the gate stays closed.
- **Failure is not denial.** A lookup that errors fails the request as a retryable error; it is never
  reported as `NotAvailable`.
- **Specifications always run with everything available.** They verify behavior, not entitlement. There is
  no `given availability` form; do not invent one, and do not write a specification to prove a gate.
- **Events and observers are unaffected.** A reaction that produces into an unavailable slice is fine and
  projections keep running, so switching a part on needs no replay. A reaction is never gated and runs with
  the tenant's and system's audiences, never a user's.
- **Persona `audience` lines are authoring only.** `audience Plus` under a `persona` tells the board, Studio
  and docs which audiences the persona is in. It changes nothing at runtime and is not in the executable model.
- **Suspension is not a gate.** It is runtime state, never in the model and never in a specification.
- **Cross-slice warning (PLAY1139).** A screen action, form or reaction that `invokes` a command whose audiences
  can be off while the invoker's are on can be refused as not available. Align the audiences, or accept and say
  why. `when` conditions are opaque and skipped, never guessed.

## Three things called audience

| Name | Is |
| --- | --- |
| Screenplay `audience` | Who a part of the application is available to; membership granted at runtime |
| Chronicle routing audience | An event-routing label in event options; never an event field of the model |
| Token `aud` claim | Who a token is for; read as `$context.identity.claims.aud` |

They are unrelated. Never use `aud` to decide availability by name-matching an audience.
A gate needing both an audience and a Box Office entitlement reads a host value
(`provide entitlements from host`) in `available when`.

## Provided context values

`provide <name> <Type>[ optional] from <source>` adds `$context.<name>` for everything beneath the level it
is written at: application, module, feature (features nest) or slice.

```screenplay excerpt
module Fleet
  provide region String from "Nordics"

  feature DataQuality
    slice StateView Vessels
      provide vessel Vessel optional from query VesselByKey by $context.arguments.vesselId
```

- **Sources:** `query <Query> [by <expression>, ...]` (a declared, keyed, snapshot, non-observable query whose
  result type equals the provided type), `host`, a literal, an expression over other `$context` values,
  or a `file`/inline code body under the line (not both with `from`).
- **Levels:** the nearest declaration of a name wins and must keep the type (PLAY1125). The same name twice at one level
  is PLAY1123. Resolved once per request, lazily.
- **Reserved names:** `tenant`, `identity`, `causedBy`, `causation`, `occurred`, `audiences`, `command`, `arguments`
  cannot be provided (PLAY1124).
- **State the key per job at the slice.** A slice states `$context.command.<key>` for a command and
  `$context.arguments.<key>` for a query. A feature-level provider cannot do both; override at the slice.
- **Required versus optional.** Without `optional` the value is required: when absent, the request is refused with a
  clear reason. With `optional`, code sees `null` and a gate reading it denies.
- **Absence versus failure.** Absence (no key, no row, host did not supply) is unknown, not an error. Failure (store down,
  body throws, timeout) fails the request as a retryable error, never a denial.
- Code reads `context.Values.<Name>` or `ValuesAs<T>()` on `CommandContext`, `QueryContext`, `RuleContext`,
  `PolicyContext` and `ProvideContext`.
- `host`, inline code and `file` sources are opaque: the reference evaluator reports a gate that reads one as
  unsupported, never allowed or denied. A `provide` from `file <path>` or an inline `csharp` block is admitted from ESM v57
  as an opaque implementation attachment (role `ProvideValue`); older models refuse it with PLAY0268. The evaluator never
  runs it and treats every gate as available, so specifications run unchanged but cannot assert allowed or denied outcomes
  that depend on a code `provide`; the host decides at run time.
- **Identity stays out of rules by default.** `RuleContext` sees `CausedBy`, not `Identity`; roles and claims belong in a
  `policy`. A `provide` derived from `$context.identity` makes that value readable in a rule, so write it
  only deliberately and say why.

## A complete model

Read [complete example](references/complete-example.md) for a model that compiles with gates, an availability, a persona audience and a provided value.

## Who owns what

Read [runtime ownership](references/runtime-ownership.md) when a request asks where a gate is enforced, how
audiences are granted, how parts are suspended, or whether application code can check one. The engine lives in Arc (`Cratis.Arc.Availability`).

## Review checks

Read [review checks](references/review-checks.md) before accepting a model that uses `available` or `provide`.

## Diagnostics

PLAY1119-1129 are `provide` (line shape, source, body, duplicates, reserved names, type override, query source, cycle).
PLAY1130-1141 are `audience`, `availability` and `available` (shape, duplicates, undeclared, cycle, unprovided value,
cross-slice invocation, gate tokens and parentheses). PLAY1171 is a misplaced `not`; PLAY1172 is an element gate broader than the bound part.
Fix by changing the model: declare the audience, name the availability, provide the value or correct the key; never remove a
gate to silence a warning.
