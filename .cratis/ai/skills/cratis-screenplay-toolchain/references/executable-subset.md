# Executable subset (what binds: V2 and V3)

What the binder admits, and what it refuses with which code. The answer depends on the
compiler version: standalone Screenplay 4.68.0 admits ESM v1 to v7; the 4.66.0 compiler bundled in
cratis 3.28.2 and 3.28.3 admits v1 to v6; the 4.60.1 compiler bundled in cratis before 3.28.2 admits v1 to v5.
Tool facts and the exact v6 messages: `versions.md`. Always name
the tool with a V2 or V3 result. When tool and documentation disagree, the tool decides
current capability; the documentation and the domain decide intended correctness. Record
the gap, never strip the model to pass.

Binding is observed only through MCP (`read-workspace view=executable-diagnostics`) or a
render. `screenplay <folder>` and `cratis screenplay validate` never bind (`verdicts.md`).

Complete examples that bind live in `executable-example.md` (both compilers),
`pdl-example.md` (projections, both compilers) and `automation-translate-example.md`
(ESM v6; standalone tool and cratis 3.28.2 or later) and `generated-responses-example.md`
(ESM v7; standalone tool 4.68.0 or later only).

## Admitted on both compilers

- `StateChange` and `StateView` slices.
- A command with one `identifier`; `produces <Event>` with `for <identifier>` on every
  production.
- `produces when` with `==`/`!=` on scalar text, enum, number or boolean, and ordering on
  numbers.
- Mappings from command properties, string and number literals, `$context.occurred`,
  `$context.identity.id`, `.name` and `.userName` (aliases `causedBy.subject`, `.name`,
  `.userName`). Binding is not execution: a clock-only reference scenario supplies no caller
  audit identity.
- Concept and command rules: `not empty`, `min`, `max`, `length ==`, `matches`, numeric
  comparisons, `all >`/`all >=` on numeric collections, `require <command-property
  condition>`, `severity`. The operand is a literal, never a property reference.
- Declarative policies (`require role`, `authenticated`, `claim ... matches`) on module,
  feature, command and query. Ownership policies `claim "x" matches subject` or `matches
  <commandProperty>`.
- `constraint ... unique <prop> on <Event>`. Admission is separate from the open Chronicle
  durability defects (`versions.md`): never treat admission as proof of uniqueness.
- A `readmodel` with one unambiguous key: one or more keyed queries `query XById => RM optional`
  in its slice, all using the same `by xId XId` property, whose name equals a read-model
  property (each with optional `authorize`). Two different `by` properties on one read model are
  PLAY0268; a list query (`=> RM[]`) is a separate blocker.
- One projection per read model: `from`, `every`, `all` (one block per level), `join`,
  `children`, `nested`, `remove with`, `remove via join` (binds; blocks the execution plan at the projection level, see below), `clear with`, counters, `add`,
  `subtract`, `set`, `clear`, variants, and the identifier mapped from the projection's key (`xId = $eventSourceId` only for an event-source key).
- Specifications: `given caller`, `given <Event> for`, `when <Command>`, `when append
  <Event> for`, `then <Event> for`, `then error "msg"`, `then denied`, `then query ...
  arguments ... result`, `then no readmodel RM for "key"` (ESM v5), and when-less view
  specifications ending in `then query` or `then readmodel`.
- `seed`. Personas, screens and descriptions are PLAY0270/PLAY0269 information, not
  blocking.

## Admitted from Screenplay 4.61 (ESM v6): standalone tool and cratis 3.28.2 or later

- `slice Automation` with `reaction`: `when <Event>` (with values) then `produces` (no
  `for` means the trigger's event source) or `invokes <Command>`; `where`; clock `at ... on
  ...` with an explicit `for`. The invoked command runs its full pipeline with **no caller**
  (Screenplay#383, open): a gated command rejects and the rejection ends the scenario.
  Keep the gate and record the capability gap; never strip authorization.
- Application `trigger` declarations and `when trigger` specifications.
- `slice Translate` with `capture` (`key`, `map ... translate`, `append ... when x from "a"
  to "b"`), and `given capture` / `when capture` specifications.
- `given clock` and `when clock`. The clock is UTC and exact; an occurrence fires if it is
  due **after** the given clock and **at or before** the when clock, once each, in time
  order. `when clock` needs `given clock`. Limits: 10,000 occurrences per advance, 1,000
  facts per scenario. A scenario with given equal to when fires nothing.
- Command specifications that list reaction cascades (no false PLAY0285).
- In a `then` list after `when append`, only what followed the appended event.

## Generated values and responses (ESM v7): standalone 4.68.0 or later only

Facts read at `v4.68.0`: decision 0026 and `Documentation/screenplay/{commands,specifications,interoperability}.md`.
A model selects ESM v7 only when it uses a generated property, a response, a generated fixture or a `then returns`
expectation; every other model keeps its version, bytes and revision. The cratis CLI 3.28.3 (bundled 4.66.0)
reports `PLAY0268` for these constructs, and Stage 4.24.2 refuses ESM v7 with `STAGE-ESM-016` (Stage#201 in
progress), so they bind and run but are not rendered: gap-fill with the model as contract. Complete example:
`generated-responses-example.md`.

- A generated property is command-only, required, scalar and a concept backed by `Uuid`; bare `Uuid`, optional and collection
  types are invalid. Modifier order is `Type optional generated identifier`.
- Generated values are not request inputs, form fields, invocation arguments or ordinary `when` values. Generation
  runs after authorization and validation and before productions, so a denial or a validation failure never
  reaches it.
- A policy (including inherited or composed ones and the implicit `subject` of a generated identifier), a property
  rule or a requirement that references a generated value reports `PLAY0273`; reference input properties only. A
  generated property whose concept declares any validation rule (declarative, named or code) reports `PLAY0268`.
  A reaction mapping into a generated property is invalid.
- Responses: `returns <property>` is scalar; bare `returns` opens an ordered record of `<name> [<Type>] = <property>` fields
  over direct properties of the same command (collections, read aliases, arithmetic and whole read models are not
  supported). A response exists only on acceptance; a later reaction or scenario-query failure keeps the accepted facts and
  no response. No response differs from a response whose optional source is `Null`.
- A two-token `returns name` is a response when `name` is another property of this command; otherwise it declares a
  property named `returns`. Use `returns @name` or `@returns Type` to force one reading.
- Specifications: `when ... for "<uuid>"` supplies the generated identifier, an indented `generated <name> = <value>`
  any other generated value, and `then returns` asserts the response (scalar value, or a non-empty named subset of a
  record). A reached generated value without a fixture is `Unsupported(IdentityAllocation)`; the specification never
  passes. `then returns` is a success outcome but does not relax the events comparison.
- `for` on a generated identifier does not assert that explicitly routed productions target it. A plain `produces`
  without `for` keeps its own allocation channel, which a fixture never satisfies; a generated identifier combined
  with a reached plain production is `Unsupported(IdentityAllocation)` from source specifications.
- A reaction-invoked command that reaches generation is `Unsupported(IdentityAllocation)`; response-only commands run
  and discard the response. Generated values give no idempotency, retry or deduplication guarantee.

## Code attachments (what binds, what never does)

Inline fences (`csharp`, `typescript`, `react`, `html`, `sql`) and `file <path>` attach
code to an owner. Three kinds block binding (PLAY0268, V3 blocked, no specification runs):
the command `handler`, the `file` constraint (see below) and a query `performer`
("uses delivery, filtering, scope, or implementation behavior outside the first ESM v1
vertical"). Everything else binds as an **opaque requirement** that needs a target to
execute: reducer transitions, rule predicates, command and concept code validation, policy
predicates and reaction effects. Reaction effects bind only when the trigger has no
`reads`; a trigger with `reads` plus a `file` or inline effect fails binding. Reaction
bodies still leave their owner non-executable.

- A `file` constraint **never binds**: PLAY0268 "file implementation is not admitted by
  the executable model" (`SemanticModelBinder.Constraints.cs`). Chronicle file constraints
  can only declare uniqueness: declare it with `unique ...`, and put other rules in command
  validation or a `require` condition.

- A command `handler` **never binds**: PLAY0268 "Command '<n>' handler requires a
  constrained implementation attachment." This holds with a `file`, with a fence, and with
  `implementation` or `hint` (including a pending intent with no payload). On a handler,
  `implementation` and `hint` are authoring intent: no execution, lock or confirmation.
- From 4.65.0 a command property named rule also accepts an `implementation` block (ordered
  `hint` lines, at most one `file` or tagged fence). With a source attached it binds like a
  direct source; hints-only or empty is pending intent: valid source, PLAY0268 at binding.
  The block is rejected on concept rules, built-in property rules and whole-command
  `require`/`validate` bodies (`v4.66.0:Documentation/screenplay/commands.md`, `context.md`).
- A handler therefore makes the slice non-executable and non-renderable: it is gap-fill
  with the model as the contract.
- Stage 4.24 admits only pure reducer bodies (Roslyn allowlist, STAGE-ESM-019 and 022);
  code validation (STAGE-ESM-005) and opaque policies (STAGE-ESM-015) are refused.
- The reference runner returns Unsupported for the opaque bodies that do bind (rule and
  policy predicates, code validation, reducer transitions); a specification that needs one
  never passes. Handlers, file constraints and query performers (and reaction effects on a trigger with
  `reads`) are different: they leave the whole model unbound, so no specification runs at
  all.

## Refused (code, reason): fix, or record as a mode gap

| Construct | Code | Note |
| --- | --- | --- |
| `Automation` or `Translate` slice, `reaction`, `capture`, `trigger`; `given clock`, `when clock`, `when trigger`, `when capture` | PLAY0268 | **cratis before 3.28.2 bundles only** (4.60.1); messages in `versions.md` |
| Unquoted `import Other.Contract` | PLAY0268 | external contract import is not bound |
| `@pii` or `@sensitive` on any concept | PLAY0268 | "Concept '<n>' compliance attributes require portable data-subject semantics." Same message at 4.60.1 and 4.66.0. `@sensitive` has no verified portable meaning (Screenplay#384, open) |
| `query` returning a collection (`RM[]`), or without exactly one caller-supplied `by` | PLAY0268 | "must declare one caller-supplied 'by' argument" or "must return one optional read model" |
| `observable`, `filter`, `scoped to`, `performer` queries | PLAY0268 | "uses delivery, filtering, scope, or implementation behavior outside the first ESM v1 vertical." `observable` goes in the return position (`=> observable RM optional`); as a body line it is PLAY0048 |
| `contains` or `starts with` in conditions | PLAY0268 | equality and numeric ordering only |
| Date or DateTime comparison, `today` | PLAY0268 | no runtime date value |
| Rule on a nested path (`lines.qty all > 0`) | PLAY0268 | put the rule on the nested value's concept |
| `require` or `produces when` over a read-model path | PLAY0268 | needs decision-consistent reads (Screenplay#129) |
| `reads <View> ...` on a command | PLAY0271 (error) | legacy, cannot imply decision consistency |
| `concurrency` block on a command | PLAY0271 (error) | "concurrency metadata keeps its legacy meaning and cannot bind to ESM v1" |
| `handler` (see above) | PLAY0268 | gap-fill |
| `$context.tenant`, roles, claims, causation | PLAY0268 | no portable scalar counterpart |
| Arithmetic or raw expression in a `produces` mapping | PLAY0268 | |
| Template `` `${x}` `` or `$causedBy` in a projection | PLAY0268 | |
| More than one `every`/`all` on one projection level | PLAY0268 | Chronicle keeps only the last |
| `$eventContext.<path>` other than `eventSourceId` | blocked plan | binds, but execution refuses: "An event-context value other than the event source identity needs occurrence context that ESM v1 facts do not carry". `$context.occurred` in command `produces` is different and executes when the scenario has `given clock` |
| Projection-level `remove via join` | blocked plan | binds, but `UnsupportedProjectionBlock` blocks the whole reference execution plan: no specification in the application runs |
| `all` beside removals, children or nested on one level | blocked plan | binds; `UnsupportedProjectionBlock` |
| `join`, `children` or `remove via join` inside `nested` | blocked plan | binds; `UnsupportedProjectionBlock` |
| `$eventContext.occurred.Week` | PLAY0273 | derived value |
| Projection `parent p` where `p` is not on the child event | PLAY0273 | "Event property not found" |
| `generated` or `returns` on a compiler before 4.68.0 (4.66.0 and 4.67.0 refuse; 4.66.0 is bundled in cratis 3.28.x) | PLAY0268 | admitted from standalone 4.68.0 (ESM v7), see above |
| Operations or systems, `numbers exact`, eventsource or stream | PLAY0268 | not admitted by any supported ESM version; syntax only (`sources-and-streams.md`); one such construct leaves the **whole** application without an executable model |
| Spec of a gated command or query without `given caller` | PLAY0389 | module and feature gates count |
| `given` or `then readmodel` missing the key property | PLAY0351 | key is the keyed query's `by` |
| When-less spec asserting events or errors | PLAY0352 | |
| `null` in command or event values | PLAY0350 | Chronicle semantics, not only a binder limit: an optional fact is a separate event (nullable event properties are CHR0012) |
| `for` with no unambiguous destination type | PLAY0273 | |

## Not refused, but do not rely on it

- Plain `produces` without `for` binds (PLAY0478, information) but means allocation in the
  ESM and "the identifier" in rendered Arc code. Always write `for`.
- A projection-level (root) `remove via join` binds, but the reference execution plan refuses it (`UnsupportedProjectionBlock`), so no specification in the application runs; Chronicle wires it as a child pull. See the blocked-plan rows above.
- A projection mapping to a property the read model does not declare, and an undeclared
  event in `remove with` or a capture `append`: V1 does not report them; binding (V3) does,
  with PLAY0273 (Screenplay v4.66.0 `BindMapping`, `LevelEvent`, `BindCaptureAppends`). A
  declared read-model property that nothing maps is different: no tool reports it, so check
  field lineage by hand.

## Never do this to reach V3

Do not remove `@pii`, `@sensitive`, `authorize` or policies, list queries, automations or
rules a domain needs just to make binding pass. Report `V3 blocked: <codes>` and record the
slice in the gap list. A `@pii` or `@sensitive` attribute blocks V3 and rendering, and
`@pii` on an event-source identifier is rejected by Chronicle (CHR0034) in addition.
