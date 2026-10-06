# Executable subset (what binds: V2 and V3)

What the binder admits, and what it refuses with which code. The answer depends on the
compiler: the standalone tool (4.64.0) admits ESM v1 to v6; the cratis-bundled compiler
(4.60.1) admits v1 to v5. Tool facts and the exact v6 messages: `versions.md`. Always name
the tool with a V2 or V3 result. When tool and documentation disagree, the tool decides
current capability; the documentation and the domain decide intended correctness. Record
the gap, never strip the model to pass.

Binding is observed only through MCP (`read-workspace view=executable-diagnostics`) or a
render. `screenplay <folder>` and `cratis screenplay validate` never bind (`verdicts.md`).

Complete examples that bind live in `executable-example.md` (both compilers),
`pdl-example.md` (projections, both compilers) and `automation-translate-example.md`
(ESM v6, standalone tool only).

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
- A `readmodel` with exactly one keyed query `query XById => RM optional` and one `by xId
  XId` whose name equals a read-model property (plus optional `authorize`).
- One projection per read model: `from`, `every`, `all` (one block per level), `join`,
  `children`, `nested`, `remove with`, `remove via join` (binds; blocks the execution plan at the projection level, see below), `clear with`, counters, `add`,
  `subtract`, `set`, `clear`, variants, and `xId = $eventSourceId`.
- Specifications: `given caller`, `given <Event> for`, `when <Command>`, `when append
  <Event> for`, `then <Event> for`, `then error "msg"`, `then denied`, `then query ...
  arguments ... result`, `then no readmodel RM for "key"` (ESM v5), and when-less view
  specifications ending in `then query` or `then readmodel`.
- `seed`. Personas, screens and descriptions are PLAY0270/PLAY0269 information, not
  blocking.

## Admitted on the standalone tool only (ESM v6)

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
  `implementation` or `hint` (including a pending intent with no payload). `implementation`
  and `hint` are valid only on command handlers and are authoring intent: no execution, lock
  or confirmation.
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
| `Automation` or `Translate` slice, `reaction`, `capture`, `trigger`; `given clock`, `when clock`, `when trigger`, `when capture` | PLAY0268 | **cratis-bundled compiler only**; messages in `versions.md` |
| Unquoted `import Other.Contract` | PLAY0268 | external contract import is not bound |
| `@pii` or `@sensitive` on any concept | PLAY0268 | "Concept '<n>' compliance attributes require portable data-subject semantics." Same message at 4.60.1 and 4.64.0. `@sensitive` has no verified portable meaning (Screenplay#384, open) |
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
| `generated` or `returns` (v8), operations or systems (v9), eventsource or stream (v10), `numbers exact` (v7) | PLAY0268 | syntax only; one such construct leaves the **whole** application without an executable model |
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
  event in `remove with` or a capture `append`: neither V1 nor V3 reports them. Check by
  hand.

## Never do this to reach V3

Do not remove `@pii`, `@sensitive`, `authorize` or policies, list queries, automations or
rules a domain needs just to make binding pass. Report `V3 blocked: <codes>` and record the
slice in the gap list. A `@pii` or `@sensitive` attribute blocks V3 and rendering, and
`@pii` on an event-source identifier is rejected by Chronicle (CHR0034) in addition.
