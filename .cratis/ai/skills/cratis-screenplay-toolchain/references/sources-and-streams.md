# Event sources, streams and command routes

## Contents

- Admission
- Declare and route
- Specification routes
- Boundaries

## Admission

Sources, streams and command/specification routes bind and reference-execute as
**ESM v8** on Screenplay 4.125.0. Current evidence: released `event-sources.md`,
`specifications.md`, `Versions.cs`; the complete example below compiled with
`--warnaserror` and passed `screenplay test` on 4.125.0.

CLI 3.41.0 renders only model versions up to v7: routed v8 models receive
`CLI-RENDER-004` before planning/publication. This is not a source-validation or
binder refusal. Keep the routed model as contract and gap-fill its realization;
never remove routing to obtain a render. Pins: `versions.md`.

The 4.68.0 historical binder refusal (`PLAY0268`, no admitted version then) is
not the current disposition. Systems/operations and exact numbers still report
PLAY0268; they are separate capabilities, not evidence against v8 routing.

## Declare and route

An `eventsource` belongs to the application. Its `identifier` states the nominal
source-id type; streams belong to that source. A command's `stream Source.Stream`
selects the exact declared source/stream, with nested scalar `streamId = <value>`
for a keyed stream. Portable mapping sources are required direct non-generated
command properties or compatible scalar literals; nested paths can be authored
but refuse executable admission with PLAY0268. An unkeyed stream takes no id. Composite stream ids instead
use a bare nested `streamId` followed by all named part mappings exactly once.
A property literally named `stream` is written `@stream` where the command clause
would otherwise consume it. Do not invent source-only route syntax.

```screenplay
concept AccountId : Uuid
concept Month : Int
eventsource Account
  identifier AccountId
  stream Transactions
    streamId Month
module Banking
  feature Deposits
    slice StateChange Deposit
      command Deposit
        accountId AccountId identifier
        month Month
        amount Decimal
        stream Account.Transactions
          streamId = month
        produces event Deposited
          amount Decimal = amount
      specification Depositing
        when Deposit
          accountId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          month = 10
          amount = 40
        then Deposited
          for "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          stream Account.Transactions
            streamId = 10
          amount = 40
```

## Specification routes

`given <Event>`, `when append <Event>` and `then <Event>` may state a route;
`when <Command>` may not, because its route comes from the declaration. Routes
belong to occurrences, not event types. Scalar ids are concrete literals of the
stream's declared type; composite ids name every declared part. Routed history
and appends require a concrete `for` of the source identifier type; routed `then`
may omit it. Unknown/ambiguous destination types refuse, never default to text.

`then` without routing leaves the route unspecified (wildcard), while
`then ... no stream` explicitly expects an unrouted occurrence. `no stream` is
not permitted on `given` or `when append`; no route there already means unrouted.
An event-level `stream = ...` or `streamId = ...` remains payload, not routing.
Typed event examples may supply a route, replaced as a whole by step overrides;
`for` is independent. No spelling restores a wildcard after an example supplies
a route. See `cratis-screenplay-specifications` for fixture provenance.

## Boundaries

Reference routing does not prove target deployment, concurrency or protected
reads. Personal/secret values cannot become source or stream ids (PLAY0515),
including composite parts and nested command mapping sources. Use surrogates.
Code-level realization uses Chronicle `IEventSource`, `[EventSource]`,
`[EventStream]` and Arc's event-source route attribute; follow the corresponding
client/command skills rather than translating route metadata to payload copies.
