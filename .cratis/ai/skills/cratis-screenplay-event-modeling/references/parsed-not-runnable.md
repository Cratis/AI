# Parsed is not runnable: ESM versions and dispositions

Checked: `SemanticModelBinder.cs`, `Versions.cs`,
`Documentation/screenplay/{commands,operations,event-sources,reactions,tool,interoperability}.md`.
The binder selects v8 for event routes, v10 for declared reaction identity, v11 for retained
exact-lowered Double-mode literals and v12 for non-positional enum numbers.
Compliance (`SemanticModelBinder.Compliance.cs` and
`SemanticModelValidator.Compliance.cs`) selects v13.
Tool versions and consumer boundaries: toolchain `SKILL.md`.

## Which ESM version a model needs

- v1 by default; v2 for typed event-source facts and admitted occurrence/audit mappings.
- v3 for opaque code requirements. Reference execution cannot execute their bodies.
- v4 for event-contract lineage; v5 for keyed read-model absence assertions.
- v6 for admitted reactions, captures, application triggers and clock.
- v7 for generated command values, responses, fixtures/return assertions and policy negation.
- v8 for sources/streams and command/specification routes.
- v9 for public-event contracts; v10 for reaction `runs as system` identity.
- v11 for exact lowering of qualifying Double-mode number literals; v12 for non-positional
  enum member numbers (`cratis-screenplay-command-surface` `references/enum-numbers.md`).
- v13 for concept `pii`/`personal` and `secret`, personal qualifiers and secret scopes.
  Reasons remain report-only PLAY0270; binding proves neither encryption nor erasure.
- Operations/systems, the exact numeric **source mode** (`numbers exact`) and refusal/redelivery
  remain unadmitted (PLAY0268). Version allocation is not inferred from an older planning decision.

## Dispositions to keep apart

| Construct | Standalone disposition |
| --- | --- |
| `persona`, domain/authentication metadata | Report-only; unknown named policies remain source defects |
| Compliance concepts | Bare `pii`/`personal` and `secret`, qualifiers and scope bind as v13; enum/identity compliance and events combining personal or explicitly subject-scoped secret values with an explicit `subject` mark refuse PLAY0268 at binding only. A CLI bundle that admits v13 binds markers; Stage renders v13 protection, not protected identities/enums or subject lineage. Never remove protection |
| Identity details / processing purposes / event subject | Report-only metadata; executable detail reads refuse PLAY0268, not source declaration errors |
| Composite stream ids | v8 routing; complete named parts/canonical comparisons, PLAY0515 refuses protected keys/sources; not a legacy text split |
| Command reads/concurrency | Legacy unprotected decisions, PLAY0271 |
| Invokes-only trigger reads | Report-only, not protected state; direct production with reads refuses |
| Generated values/responses | v7 binding/reference execution; v15 strategies/strict fixtures/freshness. Stage renders supported UUID/String strategies, responses and fixtures; unsupported types/combinations remain -028/-038 |
| Sources/streams and command/specification routes | v8 binding/reference execution; the CLI (toolchain `references/renderable-subset.md`) reaches Stage checks through v15 |
| Declared reaction invocation actor | v10 binding/reference execution; older CLI parser PLAY0137; Stage renders role/authenticated reaction identity; claim-reading/opaque gates retain STAGE-ESM-034, not a v10 version refusal |
| Operations/systems, `numbers exact` source mode, refusal/redelivery | Source accepted; whole binding refuses PLAY0268 |
| UI | Authoring/deferred metadata; runtime support is a separate consumer contract |

Run standalone `screenplay test` or MCP `run-specifications` for V4. Compile
success alone is not execution; unbound/unsupported is not passed. Preserve
source that a narrower renderer cannot realize and report the addressed gap.
Routing and actor checked examples: toolchain `references/sources-and-streams.md`
and captures-and-reactions `references/invocation-identity.md`.

## The Step 7 clock example

The complete example in [nine-steps.md](nine-steps.md) (Step 7) compiles and binds with zero errors/warnings and `executableReady true`.
Its invokes-only reads still record intent rather than execute the overdue
selection. Run its admitted specifications with the current reference route
before claiming a V4 pass; no overdue-selection proof follows from binding.

## Trigger reads and event generations

Trigger reads do not enforce decision consistency. Event generations and typed repairs now ship,
but historical schemas do not supply deployed migrations.
Check actual binder, runner and consumer admission instead of equating an
accepted proposal or parsed node with a running application.
