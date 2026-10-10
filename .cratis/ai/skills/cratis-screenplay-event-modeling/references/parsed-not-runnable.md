# Parsed is not runnable: ESM versions and dispositions

Current evidence: Screenplay v4.125.0 `SemanticModelBinder.cs`, `Versions.cs`,
`Documentation/screenplay/{commands,operations,event-sources,reactions,tool}.md`.
The binder selects v8 for event routes and v10 for declared reaction identity.
Pins and consumer boundaries: toolchain `references/versions.md`.

## Which ESM version a model needs

- v1 by default; v2 for typed event-source facts and admitted occurrence/audit mappings.
- v3 for opaque code requirements. Reference execution cannot execute their bodies.
- v4 for event-contract lineage; v5 for keyed read-model absence assertions.
- v6 for admitted reactions, captures, application triggers and clock.
- v7 for generated command values, responses, fixtures/return assertions and policy negation.
- v8 for sources/streams and command/specification routes.
- v9 for public-event contracts; v10 for reaction `runs as system` identity.
- Operations/systems, exact numeric mode and refusal/redelivery remain unadmitted
  (PLAY0268). Version allocation is not inferred from an older planning decision.

## Dispositions to keep apart

| Construct | Current standalone disposition |
| --- | --- |
| `persona`, domain/authentication metadata | Report-only; unknown named policies remain source defects |
| Compliance concepts | Bare `pii`/`secret` (4.127.0); binding still refuses PLAY0268, never remove protection |
| Identity details / processing purposes / event subject | Report-only metadata (4.127.0); executable detail reads refuse PLAY0268, not source declaration errors |
| Composite stream ids | v8 routing; complete named parts/canonical comparisons, PLAY0515 refuses protected keys/sources; not a legacy text split |
| Command reads/concurrency | Legacy unprotected decisions, PLAY0271 |
| Invokes-only trigger reads | Report-only, not protected state; direct production with reads refuses |
| Generated values/responses | v7 binding/reference execution; Stage 4.51.3 member refusals STAGE-ESM-028/029 |
| Sources/streams and command/specification routes | v8 binding/reference execution; CLI 3.41.0 render boundary is v7 |
| Declared reaction invocation actor | v10 binding/reference execution; older CLI parser PLAY0137; Stage planner refuses v10 |
| Operations/systems, exact numbers, refusal/redelivery | Source accepted; whole binding refuses PLAY0268 |
| UI | Authoring/deferred metadata; runtime support is a separate consumer contract |

Run standalone `screenplay test` or MCP `run-specifications` for V4. Compile
success alone is not execution; unbound/unsupported is not passed. Preserve
source that a narrower renderer cannot realize and report the addressed gap.
Routing and actor checked examples: toolchain `references/sources-and-streams.md`
and captures-and-reactions `references/invocation-identity.md`.

## The Step 7 clock example

The complete example in [nine-steps.md](nine-steps.md) (Step 7) had historical
4.66.0 compile/binding evidence (zero errors/warnings, executableReady true).
Its invokes-only reads still record intent rather than execute the overdue
selection. Run its admitted specifications with the current reference route
before claiming a V4 pass; no overdue-selection proof follows from binding.

## Decision 0006 and shipped generations

Trigger reads do not enforce decision consistency. Event generations and typed repairs now ship,
but historical schemas do not supply deployed migrations.
Check actual binder, runner and consumer admission instead of equating an
accepted decision or parsed node with a running application.
