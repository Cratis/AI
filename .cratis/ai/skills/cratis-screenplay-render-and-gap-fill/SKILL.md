---
name: cratis-screenplay-render-and-gap-fill
description: "Deliver an accepted Screenplay `.play` model as code: probe whether `cratis render` admits the whole model, publish, then report admission, publication, Debug build and Debug tests as separate results mapped to the generated specification classes; triage model fix versus capability gap; bounded `Customizations/` adapters; drift by manifest revision; and hand non-renderable scope to `slice-implementer` with the model as the contract. Use when an accepted model must become running code, when asking whether a model renders, or after a model change. Not for: changing the model (use `cratis-screenplay-slice-design`), Stage internals (use `cratis-stage-rendering-and-sandbox`), or checking hand-written code against its slice (use `cratis-application-slice-conformance`)."
license: MIT
---

# Screenplay render and gap-fill

## Purpose

Act as a **capability probe and deterministic delivery verifier**, not as a code author.
`cratis render` takes the whole application: if any reachable construct is outside what Stage
admits, that run publishes nothing. This skill finds out what renders, publishes it, proves it
builds and that its generated specifications pass, and reports everything else honestly.
Behaviour the renderer rejects is delivered by `slice-implementer` with the `.play` model as
the contract, never smuggled into `Customizations/`.

Model-first: the model is the source of truth, Stage-managed output is derived, and hand-written
code exists only for infrastructure, adapters and scope Stage cannot render yet. The decision
rule is in `cratis-screenplay-modeling-lifecycle` ("Decide the level first"); it is not restated here.

## Verified product sources

Version pins live once in `cratis-screenplay-toolchain` `references/versions.md`. Read that file before selecting the compiler and renderer versions for delivery.

| Source | Pin | Used for |
| --- | --- | --- |
| cratis CLI | `v3.28.3` (`8b43fef`) | `cratis render` options, exit codes, publication receipt, bundled Screenplay 4.66.0 and Stage 4.24.2 (3.28.2 bundled Stage 4.24.1; before 3.28.2: 4.60.1 and 4.24.0) |
| Stage | `v4.24.2` (`32dcac4`) | admission (`STAGE-ESM-*`), ownership manifest, `Customizations/` seams, Debug-only specifications |
| Screenplay | `v4.68.0` (`79801bf`) | standalone compiler for V1 to V3 (admits ESM v7); binding codes `PLAY0268` and the code-attachment rules, read at `v4.66.0` |
| Rendered apps | Arc `22.25.0`, Chronicle `19.8.1` | `[ProtectedDecision]` (Arc 22.39.0 and later) is not available in code written into one |

Facts were read at those tags and `cratis render` was run at 3.28.2 and 3.28.3 for the worked example
(`references/worked-example.md`). The renderer facts are owned by `cratis-stage-rendering-and-sandbox`;
this skill links them and never restates the admission table.

## When to use / when not

- Use: an accepted model (P6, bound to a source identity) must become running code; "would this
  render?"; a re-render after a model change; a drift check; a build failure in `Customizations/`.
- Not for: changing the model (return edit requests to the modeler session); choosing the mode
  (the user); Stage internals and the sandbox (`cratis-stage-rendering-and-sandbox`); judging
  hand-written code against its slice (`cratis-application-slice-conformance`).

## Interview phase
**Skip if** the request names the model root, the application name, the destination and the
decision on non-renderable scope. Otherwise ask only what is missing:
1. **Which model, which accepted version?** (root, source identity from the lifecycle report).
2. **Application name** for `--name` (it is part of the application identity: keep it identical on every re-render).
3. **Destination.** Default `.ai-work/screenplay/<model-slug>/render-probe/<App>`; any other destination needs the user's intent.
4. **If admission fails:** stay in design mode, change the model for business reasons, or gap-fill by hand? (the three cases below).
5. **Seams:** outside systems, styles or packages the rendered app needs (`Customizations/`).

Unattended: assume visibly (probe destination, default name from the model root folder), never
assume an answer to 4, and record it as `blocked` for the user.

## The three cases (decide first, say which one applies)

| Case | Situation | What happens |
| --- | --- | --- |
| **A. Admission failure** | the probe reports blocking diagnostics | nothing was rendered or published by this run. Report the codes; the user chooses the next step (see "Procedure" 3) |
| **B. Generated base plus authorized gap-fill** | an earlier admitted whole-model render exists and the user separately authorized hand-written scope, or a seam the model names needs an adapter | the generated output stays managed and untouched; hand-written code lives in `Customizations/` or a separate project (seam adapters by this skill, business gap-fill by `slice-implementer`), serves named model elements only, never claims render admission, and V5 is reported for the generated base **with its scope stated** |
| **C. Fully hand-written delivery** | the scope cannot render and no generated base is wanted | `slice-implementer` delivers it with the model as the contract (`references/gap-fill-handoff.md`); V5 is `not run: no render` |

Evolved events (a model that selects ESM v4) are gap-fill too: Stage 4.24.2 admits the v4 model but refuses any evolved event and its dependent scope with `STAGE-ESM-026`, because it cannot render Chronicle event-type migrations yet (Stage#204). Events at their initial revision still render. Hand-write the evolved events and their migrations per `cratis-chronicle-event-type-migration`, with the model as the contract. The cratis CLI bundles Stage 4.24.2 since 3.28.3 and reports an evolved event with `STAGE-ESM-026` (probed); 3.28.2 bundled Stage 4.24.1 (3.28.1 and earlier: 4.24.0) and refused a v4 model with `STAGE-ESM-016`.

Generated command values and `returns` responses (ESM v7) bind and run in the reference runner on standalone
Screenplay 4.68.0 but are not rendered: the cratis CLI 3.28.3 bundles 4.66.0 and reports `PLAY0268`, and Stage
4.24.2 refuses ESM v7 with `STAGE-ESM-016` (tracked in Stage#201). A command that uses them is case A or C: keep
the model, hand-write the command and its response with the model (and its fixtures and `then returns`
specifications) as the contract, and report V3 from the standalone tool and V5 as `not run: no render`.

Models with event sources, streams or command routes are case A or C today: they cannot
bind or render (`PLAY0268`: not admitted by any supported ESM version, so also `STAGE-ESM-016`), so hand-write the code with the model as the
contract (`cratis-screenplay-toolchain` `references/sources-and-streams.md`).

Two rules hold in every case: a customization never makes a rejected model renderable, and
a whole-application V5 is never claimed from a subset. The CLI renders whole applications
only; a dependency-closed scope selection does not exist, so do not fake one with an
import-only root file.

## Procedure

1. **Preconditions.** P6 has committed the accepted `.play` files and `.screenplay/identities.json`
   when present; uncommitted model changes return to P6 before delivery. Record the source identity (`cratis-screenplay-modeling-lifecycle`
   `references/verdicts-and-modes.md` "Source identity"), the model root, `--name`,
   `--project-name`, `--root-namespace` and target `cratis`. Take V1 and V3 from
   `cratis-screenplay-toolchain`; report each with tool and version. V3 from a different
   compiler version does not prove the cratis-bundled binder admits the model (they agree on
   4.66.0 and cratis 3.28.2; an older cratis bundle binds less).
2. **Probe.** `cratis render <model-root> --name <App> --destination <probe-dir> -o json`
   (exit 0 published, 5 refused with nothing published, 1 missing input). Classify every
   diagnostic with `references/renderability-gate.md`: model fix in the chosen mode,
   capability gap, tool skew or environment. Group by code and count; do not paste the list.
3. **When admission fails** (case A) present the options, the user decides:
   (a) keep design mode and record the gaps; (b) narrow to renderable mode, where the modeler
   changes the model for business reasons and **without** removing protection (`@pii`,
   authorization, rules); (c) deliver the non-renderable scope by hand (case C), with a ledger
   entry (`references/drift-and-ledger.md`). Partial render does not exist.
4. **Publish.** The probe destination by default. Another destination needs the user's intent;
   `--force` needs approval naming its effect and destination (a request that already names them
   counts). Read the receipt: written, unchanged, removed, `recovered`. `recovered: true` means
   stop and reconcile. A refusal is a drift event, not an error to bypass.
5. **Build, then test**, each its own bounded call and only if the previous result passed. **Debug
   only**: generated specifications compile under `#if DEBUG`. Use the repository's runner
   with an explicit timeout (commands and reading the results: `references/delivery-protocol.md`).
   Map results per `.play` specification through the generated classes: expected, with class,
   passed, failed, no class.
6. **Seam adapters (Customizations only)** for a named seam; business gap-fill is `slice-implementer` work and needs the user's separate authorization (case B): read the declared hook signatures and
   the generated types the adapter touches (bounded), write the adapter behind a small interface
   with no business decisions, rebuild, retest. Never edit a managed file; never add behaviour the
   model does not state. Detail: `references/delivery-protocol.md` section 4.
7. **Report authored-UI omissions.** Stage renders the default composition only; list each
   modeled screen, form, layout, theme and persona view as "not rendered".
8. **Drift:** compare the published manifest's `semanticRevision` with a fresh render of the
   current model under the same inputs (`references/drift-and-ledger.md`).
9. **Hand off** the packet: verdict lines, spec mapping, edit requests for the modeler, ledger
   entries, UI omissions, learning candidates (at most 3).

## Hand-written parts

Adapters and non-renderable scope follow the contract rules of `cratis-application-slice-conformance`
(field inventory, specification mapping, delta delivery, never weaken a spec-derived test, the
`done | partial | blocked` status). They are linked here, not duplicated. What this skill adds:

- Hand-written scope is `done` only when no specification lacks an executable equivalent
  (`cratis-application-slice-conformance` `references/build-prompts.md`).
- One ledger scope per `slice-implementer` brief; the brief carries addresses and paths, not contents.
- Model-enforced rules realized in code (state-dependent rules) need a protected read or
  concurrency scope; never claim them from prose. In a Stage-rendered app, Arc is 22.25.0.
- Adapters that call outside systems follow `cratis-engineering-effect-boundaries`; slice
  specifications follow `cratis-application-slice-specifications`.
- Realization notes are the explicit realization requirements stated in a slice `description`
  (definition: `cratis-application-slice-conformance`, `references/contract-and-precedence.md`).
  Executable parts (specifications, mappings, constraints) win over prose, and a contradicting description is a model defect to report.

## Rules

- Compiler contract: what Stage admits is decided by the installed cratis CLI, not by the standalone
  compiler (subsets: `cratis-screenplay-toolchain` `references/renderable-subset.md`).
- This skill changes no model. Model fixes are edit requests (address, change, rationale) to the owning session.
- Code reading is bounded: `Customizations/*`, the file and line a build or test error names,
  and the declared hooks. Never browse managed output, `bin/` or `obj/`.
- `description` and `documentation` never reach rendered code. A rule stated only in prose is
  unenforced there: ledger entry or target requirement, never "delivered".
- The `cratis run` sandbox enforces neither validation nor authorization on its default engine; it
  is no evidence for denial behaviour.
- Never remove `@pii`, `@sensitive`, authorization or rules to get a render through; report the gap.
- Stop and ask only on a genuine contradiction between model, specs, descriptions and declared
  contracts, after reading the slice fully (`cratis-screenplay-modeling-lifecycle` `references/stop-or-assume.md`).
- Commit set after a delivery the user accepts: the destination's `.cratis-render.json`,
  managed output and `Customizations/`. The model and identity catalog were committed at P6.
  Never `.cratis-render/` (the journal directory) and never `.ai-work/`.
- Limits stated in this text are prompt policy unless a guard enforces them; say so.

## Gate

Before reporting done:
- Source identity, tool versions, `--name` and destination are recorded.
- V5 is four lines: admission, publication, build (Debug), tests (Debug), each a result or `not run: <reason>`.
- Every diagnostic is classified; every non-renderable scope has a ledger entry or the user's decision to stay in design mode.
- No managed file was edited; no `--force` without approval naming it.

## Verify

- Expected specifications versus generated classes versus passed, listed; a count is not a mapping.
- Fallback delivery: the ledger entry maps specifications to tests, records the field inventory
  and divergences, and `cratis-application-slice-conformance` returned a status.
- A passing test does not claim runtime guarantees (namespace, subject, constraint scope, guarded
  reads, migrations, replay) or omitted UI were delivered.
- Re-render: drift line present. `Customizations/` changes name the seam and the model element served.

## Route near misses

- Changing the model, mode or slices: `cratis-screenplay-slice-design`, `cratis-screenplay-modeling-lifecycle`.
- Which specification forms Stage accepts: `cratis-screenplay-scenario-coverage`, `cratis-screenplay-specifications`.
- Verdict commands, subsets, versions: `cratis-screenplay-toolchain`.
- Renderer facts, publication recovery, sandbox: `cratis-stage-rendering-and-sandbox`.
- Automation or translation scope (the whole slice is gap-fill): `cratis-screenplay-automations-and-translations`.
- Hand-written code against its contract: `cratis-application-slice-conformance`.
- Code review of delivered code: `cratis-code-review`.

## References (load on demand)

- `references/renderability-gate.md` - classify the probe's codes, estimate the blast radius.
- `references/delivery-protocol.md` - inputs, commands, reading results, `Customizations/`.
- `references/gap-fill-handoff.md` - the brief for `slice-implementer`, ledger flow.
- `references/drift-and-ledger.md` - drift, publication refusals, the fallback ledger.
- Read `references/worked-example.md` when preparing the classification and report for a refused render; it contains a complete model.
- Read `references/provenance.md` when checking sources and attribution for the render workflow or gap-fill brief.

## Lineage

Draws on the earlier model render workflow and, for the gap-fill brief, on Martin Dilger and Nebulit GmbH's slice
build instructions (adapted closely); see `references/provenance.md`.
