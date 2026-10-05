---
name: cratis-screenplay-event-modeling
description: "Entry point and router for model-first Cratis work: the short decision rule (model, or code), the nine-step workflow per behavior, the four slice types, the Cratis divergences from the generic method, the quick validation gate, file layout and what parsed-but-not-runnable means, then the phase skill to load next. Use when designing an information system, mapping a business process or information flow, deciding the event vocabulary or stream boundaries, turning a whiteboard model into `.play`, or when a request may change behavior in an application with a Screenplay model. Not for: Screenplay syntax and the compiler alone (use `cratis-screenplay-toolchain`), the lifecycle, verdicts and handoffs (use `cratis-screenplay-modeling-lifecycle`), or rendering a settled model (use `cratis-screenplay-render-and-gap-fill`)."
license: MIT
---

# Event modeling with Screenplay (start here)

Event Modeling is the **method**: walk a business process left to right and write
down every behavior as a command that changes the system, a view that reads it,
an automation that runs off it, or a translation of outside data. Screenplay is
the **artifact**: one language that holds that whole model - concepts, commands,
events, read models, queries, screens, specifications - in files that compile.

You are a **facilitator, not a stenographer.** Ask probing questions. Challenge
assumptions. Keep asking *"and then what happens?"* after every event, every
command, every answer. Use business language. Do not discuss databases, APIs, or
frameworks during modeling.

## Start here

**1. Decide the level (short form; master copy in `cratis-screenplay-modeling-lifecycle`).**
Check first that the method skills are installed; installing them never opts a
repository in. The work is **model-first** only in an opted-in repository: the model
root (default `.cratis/screenplay/`) holds a `.play` file, or the project explicitly set
`mcpServers.screenplay.root` in `.cratis/ai.json`. An empty directory, install output,
an installed skill, a `.play` file outside the root or an unaccepted draft is not
opt-in; a behavior is a contract only when an accepted model under the root covers it.
Otherwise stay code-first. Only the entry-point session proposes a model (at most once
per session, never for trivial, bug-fix, infrastructure, client, framework or
brownfield-maintenance work; unattended: record the recommendation in the final report).
Framework repositories and brownfield work that has not opted in stay code-first.

- **Model:** change the `.play`, verify, review, then render or gap-fill.
- **Code is right for** infrastructure, clients, Screenplay code attachments and
  handlers, adapters, and scope Stage cannot render yet (the model stays the contract).
- **Never:** use code as a shortcut around the model; change the model to match
  existing code; edit Stage-managed output; leave a modeled rule living only in
  code; weaken protection (authorization, `@pii`, rules) so a model compiles or renders.

**2. Run the lifecycle.** Load `cratis-screenplay-modeling-lifecycle` for modes, the
independent verdicts V1-V5, the P0-P9 phases with their gates, stop-or-assume,
identity ownership and handoffs. Then load **one** phase skill. Small changes enter
at the phase where they belong and run the downstream gates for the changed scope.

**3. Pick the phase skill.**

| Phase | Skill |
| --- | --- |
| P0-P1 intake, timeline, personas, events | `cratis-screenplay-discovery` |
| P2 commands, read models, screens, field lineage | `cratis-screenplay-slice-design` |
| P2 stream identity, consistency, evolution | `cratis-screenplay-streams-and-consistency` |
| P2 reactions, work queues, clocks, captures | `cratis-screenplay-automations-and-translations` |
| P3 specifications and coverage | `cratis-screenplay-scenario-coverage` |
| P4-P5 self-check and independent review | `cratis-screenplay-model-review` |
| Existing system into a model (replaces P1-P2) | `cratis-screenplay-legacy-extraction` |
| P7-P9 execute, render, fall back, verify | `cratis-screenplay-render-and-gap-fill` |
| Tools, versions, verdict commands, diagnostics | `cratis-screenplay-toolchain` |

**4. Nine steps to phase skill.** [references/nine-steps.md](references/nine-steps.md)
keeps the activities, Screenplay output and facilitation questions of each step:

| Step | Activity | Phase skill |
| --- | --- | --- |
| 1-3 | Goal, brainstorm events, order them | `cratis-screenplay-discovery` |
| 4-6 | Wireframes, commands, read models | `cratis-screenplay-slice-design` |
| 7-8 | Automations, external integrations | `cratis-screenplay-automations-and-translations` |
| 9 | Decompose into vertical slices | `cratis-screenplay-slice-design` |
| after 9 | Specifications, then review | `cratis-screenplay-scenario-coverage`, `cratis-screenplay-model-review` |

## Locate the model

Look first in `.cratis/screenplay/` at the repository root. This is the
conventional home for consumer-owned `.play` source; do not invent another
location or search the whole repository before checking it.

`cratis ai install` manages `.cratis/ai/`, not `.cratis/screenplay/`. Never
hand-copy Screenplay source between repositories. Keep Markdown that explains,
questions or navigates the model in the repository's documentation; the `.play`
source is the single flow model.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.31.0` | Compiler: parser, validator, diagnostics, folder merge, semantic binder |
| `Cratis.Screenplay.Tool` | `4.31.0` | The `screenplay` dotnet tool |
| `Cratis.Screenplay` | main `fd18129` | Inline contracts and event context; changed nine-step examples compiled |
| `Cratis.Screenplay.Tool` | `4.64.0` (`7e16162`) | Current pin: the Step 7 clock example compiles and binds; persona, generated, operation and stream dispositions below were read at this tag |

The pin set for the whole Screenplay family, and which tool reports what, lives only in
`cratis-screenplay-toolchain` `references/versions.md`. The `fd18129` update follows
`commands.md`, `events.md` and decision 0023 at that main commit (after v4.52.0);
compilation does not establish reference execution. The original baseline was checked at
tag `v4.31.0` (commit `355dffb`): `Documentation/screenplay/{slices,commands,folders,printing,interactions,specifications}.md`,
`projections/keys.md`, and decisions 0001 to 0014. Changed [nine-step examples](references/nine-steps.md)
use the newer commit and the 4.64.0 tool; do not attribute them to the old tag.

> **Method lineage.** The two-phase process, the nine steps, the four patterns and
> the GWT discipline follow **Event Modeling** (Adam Dymitruk; Martin Dilger,
> *Understanding Eventsourcing*), as structured in
> [jwilger/agent-skills `event-modeling`](https://github.com/jwilger/agent-skills/tree/main/skills/event-modeling).
> Screenplay adopts that vocabulary directly: *"Slices are the atom - everything
> lives inside a typed slice aligned with Event Modeling's vocabulary."*
> Where Cratis deliberately diverges, this skill says so.

## Two phases - discovery, then design

**Never jump into detailed workflow design without broad domain understanding.** Phase 1
maps the territory (actors, processes, outside systems, the most critical workflow; ask,
do not assume; it lands as `module`, `persona` and `import`; protocol in
`cratis-screenplay-discovery`). Phase 2 designs one workflow at a time through all nine steps
([nine-steps.md](references/nine-steps.md): activities, Screenplay output, questions).

## The prime directive: do not lose information

Store what happened (events), not just current state. Events are immutable
past-tense facts in business language. **Every read-model field must trace back to
an event.** If a field has no source event, something is missing from the model -
it is not an optional column.

## The four patterns -> the four slice types

Every behavior is exactly one. An unknown slice type is a compile error:
*Unknown slice type '<x>' - expected StateChange, StateView, Automation or Translate*.

| Pattern | Slice type | Screenplay constructs |
| --- | --- | --- |
| Command -> Event | `StateChange` | `command` -> `produces` -> `event`, plus `validate`, `authorize`, `constraint` |
| Events -> Read Model | `StateView` | `readmodel`, `projection` or `reducer`, `query`, `screen` |
| Event -> decision -> Command/Event | `Automation` | `reaction` |
| External data -> Event | `Translate` | `capture` |

**A slice is one behavior, not one artifact of each kind.** Every construct may
appear as many times as the behavior needs. Only `description` is limited to one.

**Automation has four required components** - a triggering occurrence, the state
it consults (the trigger's `reads`), conditional logic, and a resulting command
or event. If the events are always unconditionally co-produced, it is **not** an
automation: model it as one `StateChange` slice with several `produces` blocks.

**Translation is workflow-specific anti-corruption.** Generic infrastructure every
workflow needs (event persistence, message transport) is not a `Translate` slice.

## Where Cratis diverges from the generic method

Two divergences matter, and getting them wrong produces a model that will not
compile or will not be safe. Both are deliberate.

- **A command may read state.** The generic method forbids `ReadModel -> Command`
  edges. Screenplay ships `reads <ReadModel> [as <alias>] [by <property>]` so the
  model shows what a state-dependent decision consulted. **It is not a protected
  read today:** nothing checks at append time that the state is still current,
  the executable model rejects `reads` and `concurrency` (`PLAY0271`), and adding
  `concurrency` does not make the decision safe (decision 0003, Screenplay #129).
  Write a state-dependent rule as `reads <View>` plus `require <expr> message "..."`
  and mark it in the slice `description` as **not enforced in the model today**,
  naming the target that must enforce it (Arc `[ProtectedDecision]` with
  `DecisionRead<T>`, Chronicle's dynamic consistency boundary, or a constraint where
  one fits). Model uniqueness as a `unique` constraint. Never copy state into a
  command input, add an attestation flag, or hide the rule in `handler` prose. Do not
  use `reads` to fetch data the command could carry as input. A reaction trigger
  declares the views an automation decides from with the same `reads`, and the same
  caveat applies.
- **Some validation *does* belong in the model.** The generic method routes format
  rules to the type system. Screenplay's type system *is* the `concept`, and a
  concept carries its own `validate` block - so a format rule lives on the concept
  and travels with every use. A state-dependent rule is not a format rule: it needs
  the modeled `reads` + `require` intent, specifications, and the recorded
  target-enforcement gap described above.

## Naming the primitives is the highest-value work

- **Concepts before events.** `concept InvoiceId : Uuid` once, and every construct
  using it is typed end to end. The seven primitives are `Uuid`, `String`, `Int`,
  `Decimal`, `Bool`, `Date` and `DateTime`; `Enum` is a separate concept kind,
  with its values indented beneath.
- **Classify personal data at the concept**, with a reason:
  `concept PersonName : String @pii` plus an indented `pii reason "..."`. Every
  usage inherits it; a reason for an attribute the concept does not declare is an
  error. Decide this before fixing event shapes - erasure follows the subject and
  the subject follows the stream.
- **Events are past tense and self-describing** - `InvoiceRegistered`, never
  `Created`. One purpose per event; an event needing an optional property to cover
  two situations is two events.
- **The event-source identity is never an event property.** The command binds it
  with `identifier` on at most one property; marking an *event* property
  `identifier` is an error: *an event never carries its event source id*.
- **Inline events remain slice-owned contracts.** A command may introduce one
  with `produces event <Name>` and typed mappings; other slices still consume it
  by name. Extracting it changes placement, not its contract or projection meaning.
- **Storage identity is not payload identity.** `for` selects the event source;
  `id "<old name>"` preserves an event type's old persisted name on rename. New
  events omit the pin, and the pin does not replace catalog identity. Do not copy
  the same-source identifier into payload merely to project it; use `$eventSourceId`.
- **Domain facts, not runtime context.** Test: would this field have the same value
  if the event were replayed on a different machine? If not, it does not belong.

## Quick gate - before specifications are called done

Run this after the GWT specifications are written. **Do not proceed with gaps.**
When one is found, ask the user to clarify, create the missing element, re-validate.
The full critic pass (evidence, severity, business-question review) is
`cratis-screenplay-model-review`.

1. Every `readmodel` property traces to an `event` (**backward trace**).
2. Every `event` feeds a projection, reaction, or capture target (**forward trace**).
3. Every `command` has documented rejection conditions.
4. Every `reaction` has a termination condition and cannot loop forever.
5. No `given`/`when`/`then` clause references an undefined element.
6. Every behavior is exactly one slice type.
7. Read-model fields use collection types where the domain allows concurrent
   instances - ask *"can there be more than one of these at once?"* for each field.
8. No cross-cutting infrastructure is modeled as a `Translate` slice.

## Choose a file layout

Treat `.cratis/screenplay/` as one application and choose the coarsest layout
that keeps both the source and its diffs readable:

- Keep one `application.play` while it stays readable top to bottom.
- Use one file per module when modules are simple.
- Use one file per feature when features have sub-features.
- Use one file per slice when the model is large enough that a change must be
  reviewable in isolation.

Reviewability, not an arbitrary line count, triggers the next split. In a large
model, one slice per file makes a scripted edit's blast radius visible in the
diff instead of hiding cross-reference defects in a single enormous file.

At the most granular layout, folders mirror the language, one folder per level,
and every level above the slices is a **barrel file** that declares its scope
and imports what is beneath it:

- `application.play` at the root holds `domain` and imports the rest:
  `import "Shared/*.play"` for the files of `concept`, `type`, `policy`,
  `persona`, `authentication` and `seed`, then one import per module file.
- `<Module>/<Module>.play` declares the module - `description`, `authorize`,
  templates, forms - and its features. Either declare each feature inline and
  import its folder (`feature Orders` / `import "Orders/*.play"`), or import one
  `<Feature>/<Feature>.play` per feature.
- `<Feature>/<Feature>.play`, when a feature has its own file, declares the
  feature and imports its slice files (`import "*.play"`) and any nested
  feature's file.
- A slice file holds just its `slice`, at the top level. The import that brings
  it in places it in its feature, so it does **not** restate `module` or
  `feature` - the barrel above it already says where it belongs.

The root then reads as a table of contents, and every file is reachable from
it: `screenplay application.play` compiles exactly what the imports reach, and
a file no import reaches is not part of the application. Do not hand-write the
older merge-only layout, where barrels import nothing and every slice file
restates `module` and `feature` so the folder merges into one model. It compiles
as a folder, but the root says nothing about what the application holds and
every slice file repeats where it lives. The MCP `expand-layout` tool still
writes that layout; compose its output with imports when you take it over.

**Compose focused files with imports** (v4.48.0, checked at tag `v4.48.0`,
commit `3baf4a4`). `import "<path or glob>"` imports `.play` files relative to
the importing file - `**` crosses folders, `*` stays in one, `..` climbs. Where
the import is written decides where the files belong: at the top level it brings
in whole documents; inside a `module` or `feature` it places each imported file
there, so a file holds only its part of the story - a slice file is just the
`slice`. A root file that imports everything says what the application is made
of:

Layout sketches (file contents, not standalone documents):

```text
domain Acme.Commerce

import "Shared/*.play"
import "Ordering/Ordering.play"
```

```text
module Ordering
  description "Orders, from basket to doorstep"
  feature Orders
    import "Orders/*.play"
```

Every file is imported once. When a root glob and a module file both match a
file, the deepest placement wins; two placements where neither lies inside the
other are an error (`PLAY0457`), and so is a file that declares a module other
than the one it is placed in (`PLAY0459`). A placed file's top level holds only
what its scope can hold (`PLAY0460`) - a `screen template` belongs in the
module file, not in a slice file placed in a feature. `import Customers.CustomerRegistered` without quotes still
names a contract from another bounded context.

⚠️ **Compile the folder, or its root file, as one application.**
`screenplay <root file>` compiles what the root imports. `screenplay <folder>` merges every
`.play` beneath the root *before* resolving, so an event declared in one file and
produced in another resolves. Compiling files individually reports unknown types,
events and policies (`PLAY0165`, `PLAY0166`, `PLAY0167`) that are not missing.
Duplicates *across* files are real errors naming both ends (`PLAY0172`, `PLAY0173`).

Round-tripping a folder does not preserve the order of **modules, features and
slices**: they come back sorted by name, and members of one module or feature
that come from different files print in canonical kind order. Order *within* one
file is kept, and some order carries meaning: `authorize` gates and policy
operands evaluate left to right, and specification events compare in authored
order unless `then events in any order` is stated. Never encode meaning in the
order of modules, features or slices.

## Verify

```shell
screenplay .cratis/screenplay/ --warnaserror
```

(The standalone tool; `cratis screenplay validate .cratis/screenplay --warnings-as-errors`
is the fallback, and neither names the other's verdict. Versions and commands:
`cratis-screenplay-toolchain`.)

- [ ] Zero errors **and zero warnings**. An unrecognized construct inside a slice
      is only a warning (`PLAY0029`) and its block is **silently dropped** - a typo
      can delete a whole projection while the exit code stays `0`.
- [ ] Every behavior is exactly one slice type, and the whole model validates
      against the eight checks above.
- [ ] Every event is past tense, single-purpose, and carries no event-source id.
- [ ] Personal data is classified on the `concept`, with a reason.
- [ ] Specifications name the rejections, not only the happy path.
- [ ] If the model must reach a runtime, check it binds with the tool that will
      consume it. The standalone 4.64.0 binder admits Automation and Translate slices
      (ESM v6); Stage 4.24.0 admits ESM v1 to v3 and renders only `StateChange` and
      `StateView` slices, so automations and translations are gap-fill there.

## Parsed is not runnable

The compiler accepts far more than anything executes. Between the syntax tree and
any runtime sits the **executable semantic model (ESM)**, and it fails closed:
what it cannot represent reports `PLAY0268` or `PLAY0271` and the model does not
bind. Keep four states apart when you report on a model: **parsed** (the
`screenplay` tool), **bound** (ESM), **reference-executed** (specifications pass
the reference runner) and **target-executed** (Stage or a rendered application).
The independent verdicts V1 to V5 that report them are in
`cratis-screenplay-modeling-lifecycle`.

What binds depends on **which tool** you ask, so name the tool and its version:

- `Automation` and `Translate` slices, reactions, captures and triggers: the
  standalone `screenplay` 4.64.0 binds them (ESM v6). The `cratis` 3.27.1 bundle
  (Screenplay 4.60.1) reports *Slice '<name>' of type '<type>'
  is not admitted by ESM v1.* Stage 4.24.0 admits only ESM v1 to v3 and renders none of them.
- `reads` and `concurrency` on a command do not bind (`PLAY0271`), so no decision is
  protected against stale state. A reaction trigger's `reads` that only `invokes` is
  report-only intent (`PLAY0270`); one that `produces` directly fails binding (`PLAY0268`).
- `persona` declarations are report-only and never block; `@pii` and `@sensitive`
  concepts do block binding (`PLAY0268`). Keep them anyway: the classification is
  part of the model. Report the block.
- Generated values and responses, operations and systems, and event sources and
  streams are authorable but non-executable (`PLAY0268`); a command `handler` never binds.

The ESM versions, the full disposition table and the Step 7 clock example's binding
result are in [references/parsed-not-runnable.md](references/parsed-not-runnable.md)
and `cratis-screenplay-toolchain` (`references/executable-subset.md`). Model the wider
language freely when the `.play` file **is** the deliverable - documentation,
review, a shared description of a system. Never read a clean `screenplay` run as
evidence a construct works downstream.

Decision 0006 shipped in Screenplay 4.31.0: a reaction trigger can declare the
views it decides from with `reads` (see `cratis-screenplay-captures-and-reactions`),
but nothing enforces them yet. Event generations and typed repairs now ship;
generations do not supply deployed migrations. Do not treat every accepted
decision as implemented: check the construct's own page and the versions table.

## Route near misses

The lifecycle, toolchain and phase skills are in "Start here" above. Construct and neighbouring skills:

| Need | Skill |
| --- | --- |
| Commands, validation, authorization, `produces`, concurrency, `$context` | `cratis-screenplay-command-surface` |
| Projections - PDL keys, joins, children, removal, arithmetic | `cratis-screenplay-projections` |
| Read models, queries, screens | `cratis-screenplay-read-surface` |
| Layouts, templates, forms, contributions, themes, i18n | `cratis-screenplay-ui-composition` |
| Captures (CDL), reactions, triggers | `cratis-screenplay-captures-and-reactions` |
| Given/when/then specifications | `cratis-screenplay-specifications` |
| Language mechanics, the compiler, the admitted set | `cratis-screenplay-model-authoring` |
| Rendering a settled model into an application | `cratis-stage-rendering-and-sandbox` |
| Drawing the model as a Mermaid diagram | `cratis-event-model-diagram` |
| Modeling against hand-written Chronicle C# | `cratis-chronicle-event-modeling` |
