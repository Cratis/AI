<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Stage target boundaries

## Contents

- Version admission
- Renderer support is bounded
- Semantic Host and specification execution
- Bodies and implementation gaps
- Runtime package and reducer migration

Reviewed against Stage v4.197.0. A compiler accepting a model is not proof that a
renderer, semantic Host, specification runner or CLI accepts it. The product
inventory owns the review baseline, not a promise that every construct works.

## Version admission

Stage's renderer and semantic Host/specification path admit matched language and
semantic pairs **1.0–30.0 and 32.0**, not a continuous 1–32 range. V31 anonymous
conditions, mismatched and unknown future pairs remain refused. V28 adds UUID
comparisons; v29 includes decimal rules/projection products; v30 carries per-event
source routes; v32 typed capture identities must not be lost in conversion.

**CLI v3.100.0** `cratis render` independently admits semantic versions through
**v30**. Its bundled Stage then applies matched-pair and construct
gates; **v32 needs a direct caller of the reviewed Stage baseline**. The CLI checks only the semantic
version, not the pair. Do not relabel a newer model to pass it: use a capable
reviewed caller or report the CLI blocker. The introducing CLI minimums are in
[the skill's admission prerequisites](../SKILL.md); the exact bundled Stage is in
[toolchain target boundaries](../../cratis-screenplay-toolchain/references/language-admission.md#stage-admission-and-execution).

## Renderer support is bounded

- **Translate:** supported inbound `source events` captures render inbox reactors
  with durable per-key capture state. Added, field-change and transition
  conditions have explicit support; unsupported capture guards still refuse by
  name. This does not admit source-less captures, polling/webhook scheduling or a
  Translate slice mixing commands, read models, queries, reducers or reactions.
- **Outbound:** supported event-target projections in Translate render public
  contracts and outbox reactors. Public events produced directly by commands or
  reactions and unsupported foreign-event uses retain their refusals. Generated
  Translate specifications exercise the generated handlers, not a real external
  integration.
- **Atomic reactions:** event-only production can render one event-collection
  return per trigger occurrence; a selected invocation-refusal branch is its own
  batch. Multiple production triggers on the same event and routed direct
  productions retain `STAGE-ESM-043`. Models without the atomic declaration keep
  their prior behavior.
- **Composite keys:** required single non-date, non-decimal primitive/concept
  parts in a scoped projection with complete event-property parts keys for
  `from`/`remove with` blocks render. A DateTime part, a `Decimal` primitive
  part or a concept over `Decimal` is refused `STAGE-ESM-048`: Chronicle keeps
  a decimal key part's scale, so a replay can split one instance into two when
  the same value arrives as `1.0` and `1.00`. The decimal refusal lifts only when
  Stage#847 lands, which needs Chronicle#5427 to key those values as one
  instance; do not normalize scale in the model to get around it. Reducers, flat projections, joins, nested/child blocks,
  partial keys, collisions and protected live queries over that composite shape
  remain refused. Single-instance lookup by parts remains `STAGE-ESM-047` even
  though composite projections and equality-filtered lists can render.
- **Projection products:** required numeric products in supported root/child
  `from` blocks can lower through a generated event member. Optional/non-numeric
  factors and unsupported join/`every` product shapes still refuse
  `STAGE-ESM-050`. This is distinct from Play's Chronicle-definition conversion,
  which still refuses a factor rather than silently adding only one operand.
- **Query UI:** default composition supplies an input form only for an optional
  snapshot single-result lookup with a Text/UUID argument and an eligible scalar
  result field. It omits list queries, required/unkeyed single-result queries and
  unsupported arguments; it is not a general query editor. The form submits exact
  string arguments; draft editing does not execute the query.

## Semantic Host and specification execution

The semantic path is not generated Chronicle code. Atomic reaction batches run
with per-unit validation in the specification executor; earlier successful units
remain after a later failure. The live Host is stricter: it rolls back the whole
initiating command if any unit fails. Invoked commands remain separate units.
Legacy syntax execution is a separate capability gate.

Semantic specifications fold admitted composite/collection event values,
composite projection properties and numeric projection products. Composite-key
models/key-part lookups work in the live Host; specification execution still
refuses multi-part keys. Recursive composite types still refuse by name; complete
given-state seeds are not permission to execute partial/null projected seeds or
opaque reducers. A projection product absent from the run no longer blocks an
unrelated specification.

Supported `source events` capture specifications execute added/change/transition
behavior; outbound projections append public events **locally**. The live
runtime's `BlockingModelFeatures`/`RunsAround` API explains which translation
constructs it can run around: foreign facts arrive through seeds and captures do
not poll external sources. Local public appends are not external publication.
Unsupported translation shapes still refuse by name.

## Bodies and implementation gaps

Resolved C# command/concept validation bodies can render through typed contexts
and the pure-code gate; context members such as Tenant/CausedBy/Occurred remain
refused. The semantic Host/executor does not thereby execute opaque validation or
reducer bodies: reached unsupported bodies retain scoped `STAGE-IMPL-003`.
Described command handlers still refuse `STAGE-IMPL-002` in rendering, including
Stub mode; reaching one in semantic execution reports `ImplementationBody` after
its gates, rather than blocking unrelated behavior application-wide.

A **query performer** is a different contract. Verified supported C# performer
bodies can render; unsupported/unverifiable performers produce explicit
implementation gaps and a not-fully-runnable marker. A generated throwing method
or gap is not a completed implementation or publication approval. Preserve the
performer's requirement identity, query shape, authorization and reason; do not
replace missing behavior with an empty success. The `ImplementationGapMode` enum
alone does not prove a target supports stubbing another role.

## Runtime package and reducer migration

Generated applications consume `@cratis/stage.runtime` pinned to the rendering
Stage release, rather than copied frontend runtime files. Re-render existing
applications to migrate; unchanged copies are removed, while edited copies stop
the render until resolved. Do not hand-edit managed runtime files or dependencies.

Classic-to-self reducer migration is per read model and preserves the previous
observer id. It needs version-2 configuration, evidence of the existing reducer,
a publisher that handles `ArtifactRenderPlan.RequiredRemovals`, and publication
checks against changed files. A new profile alone is not migration evidence.
