# Stage admission: codes, specification rules and refusals

## Contents

- How a refusal arrives
- Event-reaction boundary
- Diagnostic codes
- Projections
- Pure reducer bodies
- Specification rules (`STAGE-ESM-011`)
- Refusals seen while drafting a model

Stage admits ESM v1 to v15 to construct planning; a newer model reports `CLI-RENDER-004`
(direct Stage: `STAGE-ESM-016`). Binding with the CLI's bundled compiler is a separate
prerequisite. The exhaustive construct table is `references/renderable-subset.md` in
`cratis-screenplay-toolchain`; run the real render before claiming anything is admitted.

## How a refusal arrives

One blocking diagnostic fails the **whole** plan and nothing is published (exit 5).
Informational diagnostics (`PLAY0270` authoring metadata, `PLAY0469`, `STAGE-ESM-023`) do not.

A refusal can come from four layers, and the code tells you which: compilation and binding
(`PLAY*`, from the CLI's bundled Screenplay), execution planning (`PLAN-*`), Stage
admission (`STAGE-*`) and the CLI itself (`CLI-RENDER-*`). A publication conflict (a
modified managed file, an unmanaged file at a planned path, a manifest from another
target or renderer) is a plain ownership error with no code. Keep the actual diagnostic or
error text; do not translate it into a `STAGE-*` code.

**A refusal is never a reason to weaken the model.** The fixes below are the ones that
keep the modeled intent. When the only way past a refusal is to drop a specification,
an event generation, authorization, a rule or a slice, keep the complete model, record
the capability gap, and route that scope to authorized gap-fill or a fully hand-written
delivery (`cratis-screenplay-render-and-gap-fill`). Changing the requirement itself is the
model owner's decision.

## Event-reaction boundary

Supported event reactions emit stable-id `[Reactor]` classes with `[OnceOnly]`,
event guards, returned commands or explicit `EventForEventSourceId` envelopes.
Required invocation inputs must be mapped; unmapped optional inputs become null.
Conditions reject optional/composite/collection/enum operands; ordering is numeric.
Mappings retain exact types. Flat projection payload keys must match every producer's
append destination, including reactions outside the scope. Unsupported mappings use
`-039`, protected destinations `-040`, collisions `-012`, read surfaces `-007`/`-009`.

The semantic Host settles cascades in one guarded append, whereas generated reactors
are independent eventually consistent observers that can fail and retry after the
initiating commit. Rendering does not prove invocation authorization or deduplication.
`runs as system [role]` emits `[ExecuteCommandsAsSystem]`; role-only and authenticated-only
invocations render. Claim-reading gates (even under `not`/`or`) and opaque gates refuse 034:
Screenplay system claims are unknown, while Arc supplies system subject claims.
`from Source` emits `[EventSourceType]`; `from Source.Stream` emits `[FromEventSource<T>]`.
Produced events remain unrouted; reserved stored filter names refuse 030.

Single-hop `when append` specifications render through `ReactorScenario`, with one
invoked `CommandScenario` using the reactor attribute identity, not `given caller`.
The fixture must select exactly one active trigger after `from`/`where`. Fan-out, deeper
cascades, multiple invocations, `$context`, read-model/query expectations and constraint-target
appends/products refuse 011. Commands producing any subscribed reaction event also refuse
011 because generated `CommandScenario` does not settle reactions. Keep refused specifications.

Reaction, reducer and observer filters render on the semantic path; legacy syntax paths
keep refusing them (034/035). ESM v8 routed read-model/query companion replay renders,
seeding source and stream metadata through `ReadModelScenario`; reserved names and
unformattable routed fixtures remain `STAGE-ESM-030`.

## Diagnostic codes

| Code | Meaning | Usual fix |
| --- | --- | --- |
| `STAGE-ESM-001` | Unsupported slice kind; `StateChange`, `StateView` and supported event-triggered `Automation` slices render; Translate is `-024` | Keep the model; gap-fill refused scope |
| `STAGE-ESM-002`, `-003` | Concept values or validation Stage cannot express; unresolved property type | Simplify the concept; fix the type |
| `STAGE-ESM-004` | A `StateChange` slice without exactly one command | One command per slice |
| `STAGE-ESM-005` | Code validation or rule predicate bodies; or a command beyond the first capability (optional event property, event revision other than the first, validation or requirement that cannot be rendered, neither `produces` nor a response) | Use declarative validation; non-initial event generations are not rendered |
| `STAGE-ESM-006` | `produces` that cannot render without changing its destination or mappings (`produces when`, literal or computed mappings, `for` not a command identifier, mappings not one-to-one with event properties, duplicate tags) | Map properties one to one; conditional outcomes (`produces when`) are a different behavior, so gap-fill unless the owner accepts splitting them into commands |
| `STAGE-ESM-007`, `-008`, `-009` | Projection count per read model (exactly one projection or reducer each); unresolvable properties or no single read-model transition (**flat** projections only); affected instance not one, not keyed by an event property, or not the event-source identity (flat projections only) | One projection per read model; see "Projections" below |
| `STAGE-ESM-010` | A query is neither an optional snapshot lookup by the read-model identifier nor an observable collection query (for example a snapshot list); each query is checked on its own. Observable list queries (keyed or unkeyed) render. A scalar validated key renders as its primitive and is converted inside the query, so an out-of-rule key finds no instance instead of failing validation; a validated concept inside a composite or collection argument is refused | Keyed `XById => X optional` queries or `observable` lists; a snapshot list is gap-fill. Equality filters render on observable collections; DateTime filters, required filters after optional ones, nested validated arguments and snapshot lists refuse 010. Filter-name collisions refuse 012. Context/single-result filters, opaque scope/performer and composite `by` remain PLAY0268 |
| `STAGE-ESM-011` | A specification cannot render (see the rules below) | Reshape it only if the assertion keeps its meaning; otherwise keep the specification, record the gap, and gap-fill with the specification as the oracle. Never weaken or delete it to get a render |
| `STAGE-ESM-012` | Generated C# names collide (properties, types, namespaces, constraints) | Rename |
| `STAGE-ESM-013` | An event-context value other than `$context.occurred` mapped in `produces` | Map a command property when that preserves the meaning; otherwise gap-fill |
| `STAGE-ESM-014` | A constraint Chronicle cannot reproduce (kind, scope, message; multi-claim in one command; optional or composite targets) | A different constraint is a requirement change for the model owner; otherwise gap-fill |
| `STAGE-ESM-015` | Authorization Stage cannot render exactly: a role-claim URI, an opaque policy nested inside a condition, an unresolved or non-portable policy, no single identifier, an opaque-policy subject that is not text, Uuid, Date or DateTime (a restriction on opaque-policy subjects, separate from declarative claim targets), an unsupported claim artifact. Role-only, authenticated, opaque pure policies, claim conditions with Uuid, Date, DateTime or text targets (numeric and Boolean claim matches render as always false) and `not`/and/or render; roles are read through the identity's `RoleClaimType` | Reshape the policy to a portable condition; otherwise gap-fill |
| `STAGE-ESM-016` | Model language/semantic pair is not an audited ESM v1 to v15 pair; the CLI reports `CLI-RENDER-004` above v15 first. v14 filters and v15 generation join v11 numbers, v12 enum numbers and v13 compliance as supported constructs, not blanket construct support | Not fixable by editing: the model needs a newer renderer. Keep the model, record the gap, gap-fill |
| `STAGE-ESM-017` | Read model or projection cannot render (property names that collide with Chronicle paths or expression syntax, mappings that overwrite the key or child identity, composite keys, `all`, the refused scope shapes below) | Reshape the projection without changing what it records, or record the gap |
| `STAGE-ESM-018` | `$strings.` key missing in the default locale or containing formatting characters | Fix the strings |
| `STAGE-ESM-019` | Reducer structure or body not admitted (outside a `StateView`, impure, does not compile) | An equivalent pure body, or gap-fill |
| `STAGE-ESM-020` | Implementation body missing, changed (hash differs) or refused by the loader | Provide the body inside the model root |
| `STAGE-ESM-021`, `-022` | Reducer typed-context or analysis failure; a construct outside the pure allowlist, or a generated name shadowing a reducer type | An equivalent pure body, or gap-fill |
| `STAGE-ESM-025` | Typed context references an earlier event revision or an earlier property identity; checked before `-026` | Reference the current revision; an earlier reference is not renderable, so gap-fill |
| `STAGE-ESM-026` | A selected event, or an event a selected slice depends on (producing command, observing projection or reducer, specification, constraint target), is above its initial revision: `Event 'X' has evolved to revision N; Stage does not render event migrations yet.` The whole selection is refused, nothing is emitted | Not fixable by editing without dropping the evolution. Gap-fill the evolved events and hand-write the migrations (`cratis-chronicle-event-type-migration`). A scoped slice of initial events that depends on no evolved event still renders |
| `STAGE-ESM-024` | Interval, schedule, application, startup and shutdown triggers, opaque reaction bodies, captures, Translate (including directed Translate), and clock/trigger/capture specifications. Event-triggered Automation slices render as Chronicle reactors, subject to `-013` and `-034` to `-040` below | Keep refused scope as gap-fill; do not confuse semantic Host settlement with live reactor delivery |
| `STAGE-ESM-027` | A specification asserting a read model is absent (`then no readmodel`) is not rendered (the semantic specification engine executes keyed absence) | Keep the specification; verify absence another way and record the gap |
| `STAGE-ESM-028`, `-029` | Generated values or responses Stage cannot render. Supported scalar UUID/String-concept strategies, v15 freshness, generation fixtures, scalar/named responses and `then returns` render; unsupported generated types report `-028` | Probe the supported form; preserve refused combinations as gap-fill |
| `STAGE-ESM-038` | Generated/response results combined with routes, generated-property/concept rules, legacy allocation, generated unique-constraint mappings, non-scalar/non-command response sources or generated-name collisions | Keep the model; gap-fill that command |
| `STAGE-ESM-039`, `-040` | Reaction conditions, destinations or mappings outside the faithful target subset; protected identity uses (including reaction destinations) and protected enum concepts | See the event-reaction boundary above; never declassify protected values |
| `STAGE-ESM-030` | Named event-source or stream definition with a reserved stored name; unformattable routed fixtures or command replay routes. The default sandbox engine also reports it for every routed model | Rename the reserved name; render the model with `cratis render`, not `cratis run` |
| `STAGE-ESM-031` | Whole-number literal outside the C# `int` range below ESM v8 (v8 and later render `long`) | Raise the model to v8 constructs or gap-fill |
| `STAGE-ESM-032`, `-033` | Public events and event-target projections or reducers (ESM v9); foreign event origins and event-source captures | Gap-fill |
| `STAGE-ESM-034` | Reaction `runs as` invoking claim-reading or opaque authorization; every `runs as` on legacy syntax paths | Keep the gate; gap-fill |
| `STAGE-ESM-035` | Observer filters on legacy syntax paths; semantic reaction/reducer filters render | Use semantic admission |
| `STAGE-ESM-036` | Per-production route overrides | Gap-fill |
| `STAGE-ESM-041` | Non-text secret concepts (Int/Decimal/Bool/Date/DateTime/Uuid), not `pii secret` | Keep classification; text backing only if it preserves the contract |
| `STAGE-ESM-037` | Events and commands from one handler, even across separate triggers on the same event in one reaction. The scaffold's Arc supports mixed results, but appends events before commands; a refused command causes redelivery and duplicate events | **Do not split the modeled reaction or drop an effect.** Gap-fill only with a proven retry-safe implementation; `[OnceOnly]` excludes replay, not retry |
| `STAGE-ESM-023` | Information: transition bodies analysed | none |
| `STAGE-CRATIS-001` to `-005` | Profile or `scene.json` not the package-owned shape; unrecognized or missing scaffold input; artifact path collision (`-004`, for example case names that normalize to one path); a modeled module or feature that would render into the reserved `Customizations/` (`-005`) | Rename the module, feature or case |
| `STAGE-AUTH-001` | Authorization cannot be rendered faithfully | As `STAGE-ESM-015` |
| `CLI-RENDER-001`, `-002` | Unknown target; invalid rendering name | Fix the option, or the model |
| `CLI-RENDER-004` | The bound model is newer than ESM v15 | Not fixable by editing: keep the model, gap-fill |
| `CLI-RENDER-005`, `-006` | Authored metadata with characters invalid in XML blocks rendering of XML doc comments; a document set that cannot be read as a workspace renders without comments (warning) | Remove the invalid characters |
| `CLI-RENDER-007` to `-010` | `ui profile` refusals (package set, profile shape) | See `--package-set` |
| `CLI-RENDER-011` to `-014` | `--scope`: unknown address; ambiguous feature and slice name; aggregate or unrecognized policy layout (render the whole application once); a dependency not in the manifest or the scope | Fix the address or add the owning scope |

`STAGE-CRATIS-FILE-001`, `-INLINE-001`, `-QUERY-001`, `-KEY-001`, `-KEY-002`,
`-PROJECTION-001` and `STAGE-EVENT-001` come from the legacy syntax renderer and the direct
runtime route, not from `cratis render`.

## Projections

Stage renders two projection forms; the restrictions differ.

- **Identity and key rule** (the one place the full rule lives; other files point here).
  1. The identifier always equals the projection's effective key: the inline `key`, else the
     `from` block `key`, else the event source. An event-source key (default or
     `key $eventSourceId`) makes the identifier the event source; an event-property or literal
     key makes it that key. Stage refuses a literal key (`STAGE-ESM-017`; scoped keys are an
     event property or the event source). Never map `$eventSourceId` onto the identifier when the key is
     something else (`from PaymentRecorded key invoiceId`): the runtime fails with "affected key
     disagrees with read-model identifier".
  2. Executable model. A flat-bound projection must map the identifier like any required
     property (the flat evaluator does not seed it): `xId = <keyProperty>`. A scoped projection
     needs no mapping: the root document seeds the identifier from the key when it creates the
     instance. Mapping it from its key (`xId = $eventSourceId` for an event-source key,
     `xId = <keyProperty>` for an event-property key) is also valid.
  3. Renderable model. A projection binds flat when every block is a `from` (no `remove`,
     join, children, nested, `every` or `all`), none has a parent key, every `from` is keyed by
     a top-level event property, and every mapping is a plain set to a declared top-level
     read-model property from a top-level event property or a non-null literal. Binding flat
     is not Stage admission. Every other shape binds scoped, including a `= null` clear or a
     dotted target.
- **Flat admission** holds only when all of these are true: one `from` naming one event
  (`STAGE-ESM-008`); every read-model property, optional ones included, is mapped from an
  event property (auto-map counts, and flat auto-map matches exact names only; a literal is
  refused, `STAGE-ESM-009`); and the key property is an identifier concept that every
  producing command's `for` fills. Anything else that binds flat is refused. When the key is
  the event source, drop the explicit key and the projection is scoped, which admits literals.
- **Scoped:** every other projection, including a plain single `from E` with the default or
  `$eventSourceId` key. Forms: several distinct `from` blocks, `remove with`, root
  `join ... on`, `children` with an identified element (one level, no children or joins
  inside a child; `remove with` and `remove via join` inside a child are admitted), `nested`
  over an optional composite property, and `every` with set-from-event-source mappings. Keys
  are an event property or the event source. The key establishes the identifier, so it must
  end up unmapped: a mapping onto it is refused unless it copies the key's own event
  property, so an event-source key admits no mapping at all (`STAGE-ESM-017`). Auto-map
  counts as a mapping: if the event carries a property with the identifier's name and type,
  declare `no automap` and map the other properties explicitly. `from E` and
  `from E key $eventSourceId` render when the identifier ends up unmapped, whether or not
  the event repeats the identifier.
- Refused in a scope (`STAGE-ESM-017`): composite keys; `all` (FromAll); `every` with
  children included beside children or nested blocks; root `remove via join`; joins,
  children or join removals inside `nested`; a `clear` inside `nested`; recursive children
  and joins inside a child; duplicate event contracts among `from`, join or
  removal blocks; event or read-model property names that collide with Chronicle syntax.
- A scope cannot also carry flat transitions.

The example in [render-example.md](render-example.md) uses a scope (`from` plus `remove with`).
A projection shape outside both forms is gap-fill, but render it before saying so.

## Pure reducer bodies

Stage renders a reducer only when each transition body passes a Roslyn analysis
against an audited allowlist: a complete statement block, pure operations over the typed
context, no directives, no writes to statics, `throw` limited to
`InvalidOperationException(string)` or `ArgumentException(string)`, LINQ lambdas that are
pure expressions, and no generated type shadowing a referenced one. Anything else is
`STAGE-ESM-019`, `-021` or `-022`. A reducer needs a `StateView` slice, its read model in the
same slice, a required Guid or text identifier and a matching keyed query. Code validation
(`STAGE-ESM-005`) is refused outright (opaque pure policies render), and a command
`handler` never binds (`PLAY0268`).

## Specification rules (`STAGE-ESM-011`)

- A specification needs a `when <Command>` of its own slice (`PLAY0273` otherwise), and
  its `then` events must be as many as the command `produces` (a `then query`
  spec fails until it also asserts the event).
- A `given caller` with a role-claim URI is refused; `role "X"` is accepted. `then denied`
  needs an authorized command and a `given caller`; a `then query` on a protected query
  needs a `given caller`.
- Admitted outcomes: `then <Event>` (ordered, or any order; duplicate contracts in any
  order are admitted for command-only assertions with compatible destinations, but not
  when a read-model or reducer expectation must replay them, which needs distinct
  contracts), `then readmodel`, `then query` (one result, scalar key), `then error` naming a
  rendered constraint or an authored message, `then denied`. Generated fixtures and
  `then returns` assertions render, as do routed companion replay and supported
  single-hop reaction appends.
- Refused: `then no readmodel` (`STAGE-ESM-027`), an unauthenticated caller carrying roles or claims (`STAGE-ESM-011`), other `when append` forms, composite values, `given readmodel` beside a
  command, error codes that name no rendered constraint, a `$context.occurred` mapping
  asserted without a supplied time, a query on a reducer-built read model, a protected
  query whose fixtures use streams other than the queried key.
- A when-less specification is admitted only as `then denied` on an authorized keyed
  query, or `given readmodel` plus `then query` on an unprotected query.
- Descriptions and event documentation render only as XML doc comments; comments are never rendered, and neither is behavior.

## Refusals seen while drafting a model

| Draft | Diagnostic | Fix that rendered |
| --- | --- | --- |
| Projection `from BerthReserved` with `berthId = $eventSourceId` (mapping the identifier) | `STAGE-ESM-017`: mappings cannot overwrite the key | Do not map the identifier; the key establishes it, so map only the other properties. `from E key $eventSourceId` plus the same mapping is also refused |
| A `then query` spec in the view slice, then one without `then <Event>` | `PLAY0273`, then `STAGE-ESM-011` | Put the spec in the command slice with `given caller`, `when`, the `then` event and `then query` |
