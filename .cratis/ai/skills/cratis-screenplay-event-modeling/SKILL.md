---
name: cratis-screenplay-event-modeling
description: Facilitate an Event Modeling session and land the result as Cratis Screenplay `.play` source — domain discovery, the nine-step workflow per behavior, the four slice types, information completeness, and the model-validation gate. Use when designing an information system, mapping a business process or information flow, deciding the event vocabulary or stream boundaries, or turning a whiteboard model into `.play`. Do not use for the language and compiler mechanics alone, and do not use to render a settled model into an application.
license: MIT
---

# Event modeling with Screenplay

Event Modeling is the **method**: walk a business process left to right and write
down every behavior as a command that changes the system, a view that reads it,
an automation that runs off it, or a translation of outside data. Screenplay is
the **artifact**: one language that holds that whole model — concepts, commands,
events, read models, queries, screens, specifications — in files that compile.

You are a **facilitator, not a stenographer.** Ask probing questions. Challenge
assumptions. Keep asking *"and then what happens?"* after every event, every
command, every answer. Use business language. Do not discuss databases, APIs, or
frameworks during modeling.

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

Checked against the Screenplay repository at tag `v4.31.0` (commit `355dffb`):
`Documentation/screenplay/{slices,commands,folders,printing,interactions,specifications}.md`,
`projections/keys.md`, and decisions 0001 to 0014. The examples in
[nine-steps.md](references/nine-steps.md) compile with that version's compiler.
Reverify before claiming another version behaves the same.

> **Method lineage.** The two-phase process, the nine steps, the four patterns and
> the GWT discipline follow **Event Modeling** (Adam Dymitruk; Martin Dilger,
> *Understanding Eventsourcing*), as structured in
> [jwilger/agent-skills `event-modeling`](https://github.com/jwilger/agent-skills/tree/main/skills/event-modeling).
> Screenplay adopts that vocabulary directly: *"Slices are the atom — everything
> lives inside a typed slice aligned with Event Modeling's vocabulary."*
> Where Cratis deliberately diverges, this skill says so.

## Two phases — discovery, then design

**Never jump into detailed workflow design without broad domain understanding.**
Phase 1 maps the territory; Phase 2 explores each region.

**Phase 1 — Domain discovery.** What does the business do? Who are the actors?
What major processes exist? What external systems integrate? Which workflow is
most critical? *Ask the user; do not assume answers.* Lands as the `module` set,
`persona` declarations, and the `import` list.

**Phase 2 — Workflow design.** One workflow at a time, all nine steps, before
starting the next. Read **[nine-steps.md](references/nine-steps.md)** — it carries
each step's activities, its Screenplay output, and the facilitation questions.

## The prime directive: do not lose information

Store what happened (events), not just current state. Events are immutable
past-tense facts in business language. **Every read-model field must trace back to
an event.** If a field has no source event, something is missing from the model —
it is not an optional column.

## The four patterns → the four slice types

Every behavior is exactly one. An unknown slice type is a compile error:
*Unknown slice type '<x>' - expected StateChange, StateView, Automation or Translate*.

| Pattern | Slice type | Screenplay constructs |
| --- | --- | --- |
| Command → Event | `StateChange` | `command` → `produces` → `event`, plus `validate`, `authorize`, `constraint` |
| Events → Read Model | `StateView` | `readmodel`, `projection` or `reducer`, `query`, `screen` |
| Event → decision → Command/Event | `Automation` | `reaction` |
| External data → Event | `Translate` | `capture` |

**A slice is one behavior, not one artifact of each kind.** Every construct may
appear as many times as the behavior needs. Only `description` is limited to one.

**Automation has four required components** — a triggering occurrence, the state
it consults (the trigger's `reads`), conditional logic, and a resulting command
or event. If the events are always unconditionally co-produced, it is **not** an
automation: model it as one `StateChange` slice with several `produces` blocks.

**Translation is workflow-specific anti-corruption.** Generic infrastructure every
workflow needs (event persistence, message transport) is not a `Translate` slice.

## Where Cratis diverges from the generic method

Two divergences matter, and getting them wrong produces a model that will not
compile or will not be safe. Both are deliberate.

- **A command may read state.** The generic method forbids `ReadModel → Command`
  edges. Screenplay ships `reads <ReadModel> [as <alias>] [by <property>]` so the
  model shows what a state-dependent decision consulted. **It is not a protected
  read today:** nothing checks at append time that the state is still current,
  the executable model rejects `reads` and `concurrency` (`PLAY0271`), and adding
  `concurrency` does not make the decision safe (decision 0003, Screenplay #129).
  Model uniqueness as a `unique` constraint; for any other state-dependent rule,
  record that the target must enforce it consistently. Do not use `reads` to
  fetch data the command could carry as input. A reaction trigger declares the
  views an automation decides from with the same `reads`, and the same caveat
  applies.
- **Some validation *does* belong in the model.** The generic method routes format
  rules to the type system. Screenplay's type system *is* the `concept`, and a
  concept carries its own `validate` block — so a format rule lives on the concept
  and travels with every use, while a state-dependent rule stays a specification.
  The split is the same; the place is different.

## Naming the primitives is the highest-value work

- **Concepts before events.** `concept InvoiceId : Uuid` once, and every construct
  using it is typed end to end. The seven primitives are `Uuid`, `String`, `Int`,
  `Decimal`, `Bool`, `Date` and `DateTime`; `Enum` is a separate concept kind,
  with its values indented beneath.
- **Classify personal data at the concept**, with a reason:
  `concept PersonName : String @pii` plus an indented `pii reason "..."`. Every
  usage inherits it; a reason for an attribute the concept does not declare is an
  error. Decide this before fixing event shapes — erasure follows the subject and
  the subject follows the stream.
- **Events are past tense and self-describing** — `InvoiceRegistered`, never
  `Created`. One purpose per event; an event needing an optional property to cover
  two situations is two events.
- **The event-source identity is never an event property.** The command binds it
  with `identifier` on at most one property; marking an *event* property
  `identifier` is an error: *an event never carries its event source id*.
- **Domain facts, not runtime context.** Test: would this field have the same value
  if the event were replayed on a different machine? If not, it does not belong.

## Model validation — the gate before implementation

Run this after the GWT specifications are written. **Do not proceed with gaps.**
When one is found, ask the user to clarify, create the missing element, re-validate.

1. Every `readmodel` property traces to an `event` (**backward trace**).
2. Every `event` feeds a projection, reaction, or capture target (**forward trace**).
3. Every `command` has documented rejection conditions.
4. Every `reaction` has a termination condition and cannot loop forever.
5. No `given`/`when`/`then` clause references an undefined element.
6. Every behavior is exactly one slice type.
7. Read-model fields use collection types where the domain allows concurrent
   instances — ask *"can there be more than one of these at once?"* for each field.
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

At the most granular layout, folders mirror the language, one folder per level:
`application.play` at the root (`domain`, `import`, `concept`, `type`, `policy`,
`persona`, `authentication`, `seed`), then `<Module>/<Module>.play`,
`<Module>/…/<Feature>/<Feature>.play`, and `<Module>/…/<Slice>/<Slice>.play` for
one slice, whole. A slice file restates its `module` and `feature`; nothing is
written twice.

⚠️ **Compile the folder as one application.** `screenplay <folder>` merges every
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

- [ ] Zero errors **and zero warnings**. An unrecognized construct inside a slice
      is only a warning (`PLAY0029`) and its block is **silently dropped** — a typo
      can delete a whole projection while the exit code stays `0`.
- [ ] Every behavior is exactly one slice type, and the whole model validates
      against the eight checks above.
- [ ] Every event is past tense, single-purpose, and carries no event-source id.
- [ ] Personal data is classified on the `concept`, with a reason.
- [ ] Specifications name the rejections, not only the happy path.
- [ ] If the model must reach a runtime, every slice is `StateChange` or
      `StateView` and binds to the executable model (below).

## Parsed is not runnable

The compiler accepts far more than anything executes. Between the syntax tree and
any runtime sits the **executable semantic model (ESM)**, and it fails closed:
what it cannot represent reports `PLAY0268` or `PLAY0271` and the model does not
bind. Keep four states apart when you report on a model: **parsed** (the
`screenplay` tool), **bound** (ESM), **reference-executed** (specifications pass
the reference runner) and **target-executed** (Stage or a rendered application).

The ESM version follows from what the model uses: v1 by default, v2 for typed
event-source facts (`produces … for <identifier>` when the event does not repeat
the identifier, `for` values in specifications, and `$context.occurred` or caller
identity in `produces`), v3 for code the model hands off (bodied reducers, code
validation, code policies). Code binds as an opaque requirement; the reference
runner reports any specification that needs it as unsupported.

For event modeling, the consequential boundaries today are:

- `Automation` and `Translate` slices, reactions, captures and triggers do not
  bind: *Slice '<name>' of type '<type>' is not admitted by ESM v1.*
- `reads` and `concurrency` do not bind (`PLAY0271`), so no decision is protected
  against stale state.
- `persona` and `@pii`/`@sensitive` concepts do not bind yet. Keep them: the
  classification is part of the model.
- UI constructs are deferred with information `PLAY0269`; they never block.

The full disposition table is in the `cratis-screenplay-model-authoring` language
reference. Model the wider language freely when the `.play` file **is** the
deliverable — documentation, review, a shared description of a system. Never
read a clean `screenplay` run as evidence a construct works downstream.

Decision 0006 shipped in Screenplay 4.31.0: a reaction trigger can declare the
views it decides from with `reads` (see `cratis-screenplay-captures-and-reactions`),
but nothing enforces them yet. Decisions 0007 to 0014 (affected read-model
instances, one data subject per event, external event origin, query paging and
live change sets, event generations, typed context descriptors) are accepted but
**not available**. Do not write their syntax; note the need in prose instead.

## Route near misses

| Need | Skill |
| --- | --- |
| Commands, validation, authorization, `produces`, concurrency, `$context` | `cratis-screenplay-command-surface` |
| Projections — PDL keys, joins, children, removal, arithmetic | `cratis-screenplay-projections` |
| Read models, queries, screens | `cratis-screenplay-read-surface` |
| Layouts, templates, forms, contributions, themes, i18n | `cratis-screenplay-ui-composition` |
| Captures (CDL), reactions, triggers | `cratis-screenplay-captures-and-reactions` |
| Given/when/then specifications | `cratis-screenplay-specifications` |
| Language mechanics, the compiler, the admitted set | `cratis-screenplay-model-authoring` |
| Rendering a settled model into an application | `cratis-stage-rendering-and-sandbox` |
| Drawing the model as a Mermaid diagram | `cratis-event-model-diagram` |
| Modeling against hand-written Chronicle C# | `cratis-chronicle-event-modeling` |
