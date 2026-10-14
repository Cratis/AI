<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Fresh generated append targets

Requires Arc 22.95.0 and Chronicle client 19.59.4 for guarded generated targets; deploy a Chronicle kernel 19.40.1 or later for retry-time emptiness checks. Check package references and the deployed kernel version before relying on the guard; older Arc needs an explicit whole-source `BeforeFirst` scope.

A `[GeneratedValue]` parameter defaults to `GeneratedValueFreshness.Guarded`.
When an Arc-owned append targets a validated value generated in that invocation,
it requires the **whole event source** to be empty, including other streams and
event types. Payload-only and response-only generated values add no scope.
Returned events, tuples, wrappers, `EventsWithConcurrencyScopes` and aggregates
acquired for that generated identifier are covered. Direct `IUnitOfWork.AddEvent`,
`AddEvents` and `eventLog.Transactional.Append` calls are not: return events
through Arc or supply the exact emptiness scope explicitly.

An occupied destination returns `ValidationResultReason.ConcurrencyViolation`
with `ReasonDetail` `GeneratedIdentifierCollision`. Arc does not rerun `Handle()`.
A new invocation can generate another value, but first resolve an uncertain
commit: freshness is not idempotency. A fixed scenario pin remains fixed.

A compatible whole-source `BeforeFirst` scope merges with the guard. A conflicting
explicit scope, including `ConcurrencyScope.None` or a narrowed scope, fails with
`ConflictingConcurrencyScopes` before append. Without a transaction, keep each
generated source's returned events contiguous; an interleaved shape that would
split its guard fails with `GeneratedIdentifierEventsCannotBeSplit`.

Only when appending to an existing generated destination is intentional, use this
parameter attribute fragment (imports `Cratis.Arc.Commands.ModelBound` and
`Cratis.Arc.Commands`):

```csharp
[GeneratedValue(Freshness = GeneratedValueFreshness.Unguarded)]
```

The opt-out retains generation, validation and capture, not automatic freshness.
Client-minted and natural identifiers are outside this generated-parameter policy;
use an appropriate constraint or explicit concurrency scope for them.

## Specify the collision

Use `new CommandScenario<TCommand>().UseDecisionReads()` **before seeding**, then
`PinGeneratedValue(name, id)` and `Given.ForEventSource(id).Events(existingEvent)`.
Assert the concurrency reason and collision detail, unchanged append tail and
one handler execution. Also cover an empty source receiving two events and an
occupied source whose events belong to another stream.

Requires Arc 22.95.1 for `GeneratedIdentifierCollisionRequiresDecisionReads`:
default scenario mode fails fast when given events and a guarded pin share an id.
Older default mode silently leaves the append log empty; it cannot prove occupancy.
Run `dotnet build -c Debug` and the affected specification project with
`dotnet test`; all collision and empty-source facts must pass.
