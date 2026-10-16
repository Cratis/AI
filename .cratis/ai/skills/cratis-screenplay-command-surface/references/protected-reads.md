<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Protected command reads

## Contents

- Admission and paths
- Absence and races
- Repair and target boundary

Requires Screenplay 4.193.0 or later (`screenplay --version`); older compilers refuse command reads with PLAY0271 and read paths with PLAY0268.

Declare `command reads protected` once in the application-root document. Imported
commands inherit it. This selects ESM v25, including when text rules are used, and
records `commandReadMode: "protected"`. Without it, legacy reads retain PLAY0271,
read paths retain PLAY0268, and bytes/version stay unchanged. A higher ESM version
alone never opts an application in.

Complete model:

```screenplay
domain Inventory
command reads protected
module Stock
  feature Allocation
    slice StateView CurrentStock
      event StockCounted
        quantity Int
      event StockRemoved
      readmodel Current
        id String key
        quantity Int
      projection CurrentProjection => Current
        from StockCounted
        remove with StockRemoved
    slice StateChange Allocate
      command Allocate
        id String identifier
        stockId String
        reads Current by stockId
        validate
          require Current.quantity > 0
            message "Stock must be available"
        produces Allocated
          for id
          quantity = Current.quantity
      event Allocated
        quantity Int
```

## Admission and paths

`reads <View> [as <alias>] [by <input>]` looks up required state. Omitted `by` uses
the declared command identifier; no identifier is PLAY0782. Repeated reads of a
view each need a distinct alias; paths use the alias rather than the view name.
Aliases start with a lowercase letter or underscore.

Every read must satisfy both boundaries:

- A finite non-empty set of event-log event types builds the view, including removal
  handling; the key is event-source identity only.
- The lookup key is a required scalar non-generated command input: String, a String
  concept or canonical GUID.

PLAY0781 refuses reducers, joins (including removal joins), children/nested scopes,
`every`/`all`, payload/composite keys, missing removals, empty handled-event sets,
named sources/streams, singleton views and unsupported/generated/optional/collection
keys. Its closed reasons are Reducer, Join, Children, OpenSubscription, PayloadKey,
ByParts, NoRemoval, EmptyHandledSet, NamedSourceOrStream, Singleton, KeyType,
GeneratedKey, OptionalKey and CollectionKey. `optional`, `advisory` and `via query`
remain refused; `via query` uses parser code PLAY0175. There is no unguarded fallback.

Single-level `read.property` paths bind in `require` operands and produced-event
mapping sources only. Deeper paths and read paths in `produces when`, response
fields, `for`, routes and derive/provide remain PLAY0268. Unknown read/property
paths report PLAY0784; ambiguous view paths report PLAY0785. A command with both
`reads` and `concurrency` reports PLAY0783: do not guess which boundary wins.

## Absence and races

Execution orders authorization → property rules → required reads → derive/provide
→ requirements → productions/responses. Missing state rejects with Validation and
message `<ReadModel> '<key>' does not exist.` before evaluating requirements or
mappings. Property-rule rejection therefore wins over absence.

Decide records the unfiltered fact-log boundary, read key and handled event types.
A matching fact after that boundary makes commit return Conflict /
DecisionStateChanged with no command facts, including publications. Irrelevant
facts do not conflict and remain in the committed world. Even a no-fact command is
checked. Race cases are evaluator vectors, not a new `.play` specification construct.

Specify present/absent state, rule refusal and denial. Assert no new facts and
unchanged views on failure; use target concurrency tests to prove actual storage
protection. Ordinary injected read models are not protected decisions; uniqueness
still belongs in a `unique` append constraint.

## Repair and target boundary

PLAY0780 rejects duplicate, conflicting or non-root preambles. Informational
PLAY0786 identifies an eligible legacy model at its first command read. Discover
`read-workspace view=repairs`, then `propose-repair` with current workspace/catalog
revisions and canonical formatting consent; review with `read-proposal` before
explicit `apply`. The repair inserts into the domain document or sole document,
refuses ambiguous roots and requires individual review, never fix-all. It changes
absence/conflict behavior, not merely formatting.

Stage admits ESM v25, but the Cratis C# renderer refuses protected reads with
STAGE-ESM-044: no artifacts are emitted. Preserve protection and deliver authorized
hand-written enforcement through render-and-gap-fill; never remove the preamble.

Requires Stage 4.129.0 for semantic Host/specification-executor protected reads;
older engines refuse STAGE-ESM-044. They require presence before requirements or
generation and use stored read properties in requirements and produced mappings,
including reaction-invoked commands. Any non-Error requirement on a protected
command refuses STAGE-ESM-045 before execution, even when a rejection is expected.
Legacy Host and structural runner still refuse the preamble with STAGE-ESM-044.
The semantic Host faults on any outside append, even an unrelated one, before
committing an accepted command: stricter than dependency-scoped reference conflicts,
not proof of full conflict parity. Read Stage's [sandbox boundaries](../../cratis-stage-rendering-and-sandbox/references/sandbox-and-specrunner.md#protected-command-reads).
A semantic-engine pass is separate from reference behavior and from generated Arc
protection. `screenplay <root> --warnaserror` must exit zero;
`screenplay test <root>` separately establishes reference behavior, not target support.
