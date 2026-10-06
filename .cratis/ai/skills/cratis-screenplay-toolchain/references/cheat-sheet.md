# Screenplay cheat-sheet (tool versions: versions.md)

The syntax lives in compiled example files next to this one (each is a Markdown file holding
one complete `screenplay` fence). Copy shapes from them; do not write a form that none of
them (or a compiled documentation example) shows. This file holds the prose rules; the
examples belong to `cheat-sheet-example.md` and its siblings.

| File | Mode | V1, warnings as errors | V3 (binds) |
| --- | --- | --- | --- |
| `cheat-sheet-example.md` | design: every construct family | 0 diagnostics on the standalone tool; cratis 3.27.1 (4.60.1) reports a false PLAY0285 on the `RecordingAPayment` cascade spec, so the fence carries the marker below and skips cratis | not ready by design (its header lists why; fewer blockers on the standalone tool) |
| `executable-example.md` | executable, StateChange and StateView | 0 diagnostics, both tools | ready, both tools |
| `pdl-example.md` | executable projections | 0 diagnostics, both tools | ready, both tools |
| `automation-translate-example.md` | executable Automation and Translate (ESM v6) | standalone tool only (first line `// Needs the standalone screenplay compiler (ESM v6)`) | ready on the standalone tool only |

Screenplay sources: `Documentation/screenplay/grammar.md` (EBNF; checked against the parsers
by `for_Documentation/when_comparing_the_grammar_against_the_parsers.cs`),
`projections/grammar.md`, `captures/grammar.md`. Documentation examples compile in
Screenplay CI (`when_compiling_every_example.cs`) against repository main: the standalone
compiler, not necessarily the cratis-bundled one (`versions.md`).

## Lexical and structural rules
- Spaces only, 2 per level (tabs: PLAY0006 W). Offside rule.
- Comments: `//` only. `#` is not a comment (PLAY0058 E in a projection) despite doc examples.
- Order is free (forward references fine) except `domain` first in the file and `description`
  first in a body.
- Strings: `"..."`, escapes `\" \\ \n \r \t`; other backslashes kept (regex `"^INV-\d{6}$"` works).
- Structured values: single-line JSON, quoted keys (`[{"sku": "A-1", "quantity": 2}]`).
- One condition grammar (policy `require`, `produces when`, `require`, reaction `where`): `and`
  binds tighter than `or`; operators `== != > >= < <= contains`, `starts with`; claims use
  `claim "x" matches "v"` (not `==`: PLAY0120).
- Keyword escape `@name` for properties named `tag`, `authorize`, `produces`, `reads`, `file`,
  `validate` (enum value), `sequence`, `occurred`, `causedBy`, `namespace`, `correlation`,
  `causation`, and projection `key`/`parent`/`with`.
- `type` and `concept` are top level only (inside a slice: PLAY0029, silently dropped).
- Concept rules have no subject: `not empty`, `min 3`, `max 10`, `length == 10`,
  `matches email`, `matches "regex"` (`length 3 to 10` / `length >= 3`: PLAY0141).
- Property modifiers: `Type[]`, `Type optional`, `Type[] optional`; order `Type optional
  generated identifier` (PLAY0484); legacy `?` is PLAY0479 (information).
- Ownership policies: `require claim "ownerId" matches subject` (subject = command identifier
  or keyed query argument) or `matches <commandProperty>`; executable; renderable only for
  text-backed targets (Uuid-backed: STAGE-ESM-015).

## Clause order inside a command (canonical)
description, properties, `reads`, `authorize`, `validate`, `produces`/`handler`, `concurrency`.

## Slice contents (typical)
- `slice StateChange <Cmd>`: command, its events, constraints, dialog screen, success/rejection/denial specs.
- `slice StateView <View>`: readmodel, keyed query (+ design-mode list query), projection or reducer, screen, view specs.
- `slice Automation <Behaviour>`: reaction(s) + events they produce + specs.
- `slice Translate <Behaviour>`: capture and/or translator reaction + both vocabularies' events.
- Declare each event once, in the slice that produces it; reference it by name elsewhere.

## `$context.` paths (command `produces`)
`occurred`, `tenant`, `command.<p>`, `arguments.<p>`, `causedBy.subject|name|userName`,
`causation.type`, `identity.id|name|userName|isAuthenticated|roles|claims.<n>`.
Binder-supported (`BindOccurrence`, v4.66.0): `occurred`, `identity.id` (= `causedBy.subject`),
`identity.name` (= `causedBy.name`), `identity.userName` (= `causedBy.userName`). `tenant`,
roles, claims, causation, `command.<p>`, `arguments.<p>`: PLAY0268. Binding is not execution:
a reference scenario that supplies only a clock carries no caller audit identity, so check the
reference runner before relying on identity paths in a specification. Renderable:
`$context.occurred` only.

## `$eventContext.` (projections)
`eventType{.id,.generation,.tombstone}`, `eventSourceType`, `eventSourceId`, `eventStreamType`,
`eventStreamId`, `sequenceNumber`, `occurred`, `occurred.Week`, `eventStore`, `namespace`,
`correlationId`, `causedBy{.subject,.name,.userName,.onBehalfOf}`, `hash`, `subject`,
`subjectIsEventSourceId`, `observationState` (unstable on replay). `causation` and `tags` are
collections (path below them: PLAY0297 E). Unknown member: PLAY0295/0296 W.
`$eventSourceId` is the short form used in mappings. `occurred.Week` compiles but does not bind
(PLAY0273: derived value). Any `$eventContext` path other than `eventSourceId` binds, but the execution plan refuses it ("An event-context value other than the event source identity needs occurrence context that ESM v1 facts do not carry"), so a model that must run uses `$context.occurred` in the command `produces` instead (it executes when the scenario has `given clock`). Catalogue: `Documentation/screenplay/projections/event-context.md`.

## PDL quick reference (most forms are compiled in `pdl-example.md` or `cheat-sheet-example.md`; `remove via join` and `$eventContext.occurred` are not)
- Header `projection Name => ReadModel`; variant group `projection Name` + `variant RM` /
  `enters on Event [key k]`.
- Directives: `no automap` (AutoMap is on by default; scoped projections match names case-insensitively for the same type, flat-bound ones exact names only), `every`
  (mappings applied for every event), `all` (per event source, never global), `from Event [key k]`.
- Mappings: `target = source`, `"literal"`, `$eventSourceId`, `$eventContext.occurred` (binds, but blocks the execution plan),
  `increment n`, `decrement n`, `count n` (in `all`), `add t by x`, `subtract t by x`,
  `set t to "v"`, `clear t`.
- `join Label on rmProperty` + `with Event` (matches the joined event's source id against the
  property; the label is decoration; joins never create instances).
- `children prop identified by k` + `from E key k` + `remove with E key k`; `nested prop` +
  `from` + `clear with E`.
- Removal: `remove with Event`; `remove via join on Event` is compile-only and bind-only: at projection level it blocks the whole reference execution plan (`UnsupportedProjectionBlock`), so no specification runs.
- Keys: only on `from` (a projection-level `key` routes nothing: PLAY0381 W).
- One `every`/`all` block per level for the executable model (else PLAY0268).
- Templates (`` `${a}` ``) and `$causedBy` parse but do not bind (PLAY0268).

## Specification forms
Full list with semantics: `Documentation/screenplay/specifications.md`. Compiled in the
examples: `given caller` (+`authenticated`, `role`), `given clock`, `given <Event> for`,
`when <Command>`, `when append <Event> for`, `then <Event> for`, `then error "msg"`,
`then denied`, `then query ... arguments ... result`, `then no readmodel RM for "key"`.
`then` events are exhaustive and ordered; after `when append` (ESM v6) they list only what
followed it. Duplicate and competing-claim checks use `when <Command>` with the earlier fact
as `given`. Specification construct depth: `cratis-screenplay-specifications`.
