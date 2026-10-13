# Stage admission: codes, specification rules and observed refusals

## Contents

- Event-reaction boundary at Stage 4.89.1
- Diagnostic codes
- Projections
- Pure reducer bodies
- Specification rules (`STAGE-ESM-011`)
- Observed refusals
- Source disagreements (trust the code)
- Historical Stage 4.24 admission

Current pins: `cratis-screenplay-toolchain/references/versions.md`. The current statements here
were read at Stage `v4.89.1` (`Documentation/reference/generated-values-rendering.md:62-146`,
`reaction-rendering.md:57-98`, `Source/Rendering.Cratis/Semantics/SemanticVersionFeatures.cs:105`,
`SemanticVersionFeatureAdmission.cs:25-46`, `SemanticCratisAdmission*.cs`) and cli
`v3.57.0` (`Directory.Packages.props:8-10`,
`Source/Cli/Commands/Render/RenderedSemanticVersions.cs:33-47`); the rows and
sections marked *historical* or naming Stage 4.24 or cratis 3.27/3.28 are earlier probes kept as
history. Stage 4.89.1 and CLI 3.57.0 admit ESM v1 to v15 to construct planning.
The bundled Screenplay 4.147.1 binds v14 collection filters and v15 generation;
supported filters, strategy factories, freshness scopes and scalar/named responses render.
Binding with the bundled compiler remains a separate prerequisite.
The pinned Stage's `SemanticVersionFeatures`/`SemanticVersionFeatureAdmission` refuse
public publication (STAGE-ESM-032), foreign events/events-source captures (033),
production overrides (036). Reaction identity renders for role/authenticated gates;
claim-reading/opaque gates retain 034. Reaction and reducer filters render on the semantic path;
legacy paths retain 034/035. Non-text secrets refuse 041. ESM v8 routed read-model/query companion replay now renders, seeding source/stream
metadata through `ReadModelScenario`; reserved names and unformattable routed fixtures
remain STAGE-ESM-030. Source: Stage
`v4.89.1:Documentation/reference/event-source-routing.md:62-72`. Case tables and whole numbers as long apply to
the default; see `case-tables-and-whole-numbers.md`. Previous CLI 3.46.1's Stage
4.52.0 audited only through v7 and applied neither new rule. Current version
checks are CLI `RenderedSemanticVersions.Newest` and Stage
`SemanticVersionFeatures.Supports`. The historical CLI 3.41.0/Screenplay 4.114.0
parser rejected `runs as` with PLAY0137; that is not a current parser refusal.
The historical CLI 3.41.0 v7 canonical-corpus planning spec received
STAGE-ESM-028/029 for generated values/responses.
The detailed 4.24.x source/probe rows below are historical unless a row says 4.89.1; run
admission on the actual bundled renderer.

Read at Stage `v4.24.0`, re-read at `v4.24.1` and `v4.24.2` (`SemanticCratisAdmission.EventRevisions.cs`, `SemanticEventLineageAdmission.cs`, ESM v4 section of `Documentation/guides/build-renderer-target.md`) (`Source/Rendering.Cratis/Semantics/SemanticSurfaceLedger.cs`, `Documentation/guides/build-renderer-target.md`; 4.24.1 changed only the ledger, dependency pins and the Dockerfile) (`Source/Rendering.Cratis/CratisArtifactRenderPlanner.cs`,
`Semantics/SemanticCratisAdmission*.cs`, `SemanticSpecificationAdmission*.cs`,
`PureTransitionAdmission.cs`, `SemanticImplementationAdmission.cs`) and cli `v3.28.2`
(`Commands/Render/ScreenplayPlanning.cs`, unchanged since `v3.27.1`). Items marked *observed* were reproduced with
`cratis render` 3.27.1 while building [render-example.md](render-example.md). Anything else
is a reading of source: render the model before claiming it.

One blocking diagnostic fails the **whole** plan and nothing is published (exit 5).
Informational diagnostics (`PLAY0270` authoring metadata, `PLAY0469`, `STAGE-ESM-023`) do not.

A refusal can come from four layers, and the code tells you which: compilation and binding
(`PLAY*`, from the CLI's bundled Screenplay: 4.66.0 in cratis 3.28.3), execution planning (`PLAN-*`), Stage
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

## Event-reaction boundary at Stage 4.89.1

Source: Stage `v4.89.1:Documentation/reference/reaction-rendering.md:6-98`,
`Source/Rendering.Cratis/Semantics/SemanticCratisAdmission.Automation.cs:15-123`,
`SemanticCratisAdmission.ReactionIdentity.cs:11-28`.
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

Single-hop `when append` specifications now render through `ReactorScenario`, with one
invoked `CommandScenario` using the reactor attribute identity, not `given caller`.
The fixture must select exactly one active trigger after `from`/`where`. Fan-out, deeper
cascades, multiple invocations, `$context`, read-model/query expectations and constraint-target
appends/products still refuse 011. Commands producing any subscribed reaction event still refuse
011 because generated `CommandScenario` does not settle reactions. Keep refused specifications.

## Diagnostic codes

| Code | Meaning | Usual fix |
| --- | --- | --- |
| `STAGE-ESM-001` | Unsupported slice kind; `StateChange`, `StateView` and supported event-triggered `Automation` slices render at 4.89.1; Translate remains `-024` | Keep the model; gap-fill refused scope |
| `STAGE-ESM-002`, `-003` | Concept values or validation Stage cannot express; unresolved property type | Simplify the concept; fix the type |
| `STAGE-ESM-004` | A `StateChange` slice without exactly one command | One command per slice |
| `STAGE-ESM-005` | Code validation or rule predicate bodies; or a command beyond the first capability (optional event property, event revision other than the first, validation or requirement that cannot be rendered, neither `produces` nor a response) | Use declarative validation; non-initial event generations are not rendered |
| `STAGE-ESM-006` | `produces` that cannot render without changing its destination or mappings (`produces when`, literal or computed mappings, `for` not a command identifier, mappings not one-to-one with event properties, duplicate tags) | Map properties one to one; conditional outcomes (`produces when`) are a different behavior, so gap-fill unless the owner accepts splitting them into commands |
| `STAGE-ESM-007`, `-008`, `-009` | Projection count per read model (exactly one projection or reducer each); unresolvable properties or no single read-model transition (**flat** projections only); affected instance not one, not keyed by an event property, or not the event-source identity (flat projections only) | One projection per read model; see "Projections" below |
| `STAGE-ESM-010` | A query is neither an optional snapshot lookup by the read-model identifier nor an observable collection query (for example a snapshot list); each query is checked on its own. Observable list queries (keyed or unkeyed) render since Stage 4.49.0. Historical Stage through 4.79.0 refused a validated key; Stage 4.89.1 (since 4.79.1) renders a scalar validated key, in keyed lookups and filtered observable collections, as its primitive and converts it inside the query, so an out-of-rule key finds no instance instead of failing validation, and still refuses a validated concept inside a composite or collection argument (Stage `v4.89.1` `Source/Rendering.Cratis/Semantics/SemanticCratisAdmission.StateView.cs:139-178,180-199`) | Keyed `XById => X optional` queries or `observable` lists; a snapshot list is gap-fill. v14 equality filters render on observable collections; DateTime filters, required filters after optional ones, nested validated arguments and snapshot lists refuse 010. Filter-name collisions refuse 012. Context/single-result filters, opaque scope/performer and composite `by` remain PLAY0268 |
| `STAGE-ESM-011` | A specification cannot render (see the rules below) | Reshape it only if the assertion keeps its meaning; otherwise keep the specification, record the gap, and gap-fill with the specification as the oracle. Never weaken or delete it to get a render |
| `STAGE-ESM-012` | Generated C# names collide (properties, types, namespaces, constraints) | Rename |
| `STAGE-ESM-013` | An event-context value other than `$context.occurred` mapped in `produces` | Map a command property when that preserves the meaning; otherwise gap-fill |
| `STAGE-ESM-014` | A constraint Chronicle cannot reproduce (kind, scope, message; multi-claim in one command; optional or composite targets) | A different constraint is a requirement change for the model owner; otherwise gap-fill |
| `STAGE-ESM-015` | Authorization Stage cannot render exactly (4.73.1): a role-claim URI, an opaque policy nested inside a condition, an unresolved or non-portable policy, no single identifier, an opaque-policy subject that is not text, Uuid, Date or DateTime (Stage 4.73.1 `IsTextualSubject`; a restriction on opaque-policy subjects, separate from declarative claim targets), an unsupported claim artifact. Role-only, authenticated, opaque pure policies, claim conditions with Uuid, Date, DateTime or text targets (numeric and Boolean claim matches render as always false; Stage 4.73.1 `IsSupportedClaimPath`) and `not`/and/or render; roles are read through the identity's `RoleClaimType` | Reshape the policy to a portable condition; otherwise gap-fill. *Historical (4.24/3.27.1):* a role alone, an opaque policy or a Uuid-backed claim were refused here |
| `STAGE-ESM-016` | Model language/semantic pair is not an audited v1 to v15 pair at Stage 4.89.1; CLI 3.57.0 reports `CLI-RENDER-004` above v15 first. v14 filters and v15 generation join v11 numbers, v12 enum numbers and v13 compliance, not blanket construct support. *Historical:* Stage 4.24.2 admitted v1 to v4 and 4.24.1 and earlier v1 to v3 | Not fixable by editing: the model needs a newer renderer. Keep the model, record the gap, gap-fill |
| `STAGE-ESM-017` | Read model or projection cannot render (property names that collide with Chronicle paths or expression syntax, mappings that overwrite the key or child identity, composite keys, `all`, the refused scope shapes below) | Reshape the projection without changing what it records, or record the gap |
| `STAGE-ESM-018` | `$strings.` key missing in the default locale or containing formatting characters | Fix the strings |
| `STAGE-ESM-019` | Reducer structure or body not admitted (outside a `StateView`, impure, does not compile) | An equivalent pure body, or gap-fill |
| `STAGE-ESM-020` | Implementation body missing, changed (hash differs) or refused by the loader | Provide the body inside the model root |
| `STAGE-ESM-021`, `-022` | Reducer typed-context or analysis failure; a construct outside the pure allowlist, or a generated name shadowing a reducer type | An equivalent pure body, or gap-fill |
| `STAGE-ESM-025` | Typed context references a historical event revision or a historical property identity (Stage 4.24.2); checked before `-026` | Reference the current revision; a historical reference is not renderable, so gap-fill |
| `STAGE-ESM-026` | A selected event, or an event a selected slice depends on (producing command, observing projection or reducer, specification, constraint target), is above its initial revision (still refused at Stage 4.89.1): `Event 'X' has evolved to revision N; Stage does not render event migrations yet.` The whole selection is refused, nothing is emitted | Not fixable by editing without dropping the evolution. Stage#204 (needs Screenplay#71) tracks migration rendering; gap-fill the evolved events and hand-write the migrations (`cratis-chronicle-event-type-migration`). A scoped slice of initial events that depends on no evolved event still renders |
| `STAGE-ESM-024` | Stage 4.89.1 still refuses interval, schedule, application, startup and shutdown triggers, opaque reaction bodies, captures, Translate (including directed Translate), and clock/trigger/capture specifications. Event-triggered Automation slices now render as Chronicle reactors, subject to `-013`, `-034` to `-040` below | Keep refused scope as gap-fill; do not confuse semantic Host settlement with live reactor delivery |
| `STAGE-ESM-027` | A specification asserting a read model is absent (`then no readmodel`, ESM v5) is not rendered by the renderer (the semantic specification engine executes keyed absence) | Keep the specification; verify absence another way and record the gap |
| `STAGE-ESM-028`, `-029` | Historical blanket v7 refusals. CLI 3.57.0 / Stage 4.89.1 render supported scalar UUID/String-concept strategies and Guarded v15 freshness, generation fixtures, scalar/named responses and `then returns`; unsupported generated types still report `-028` | Probe the supported form; preserve refused combinations as gap-fill |
| `STAGE-ESM-038` | Generated/response results combined with routes, generated-property/concept rules, legacy allocation, generated unique-constraint mappings, non-scalar/non-command response sources or generated-name collisions (Stage `v4.89.1:Documentation/reference/generated-values-rendering.md:123-138`) | Keep the model; gap-fill that command |
| `STAGE-ESM-039`, `-040` | Reaction conditions, destinations or mappings outside the faithful target subset; protected identity uses (including reaction destinations) and protected enum concepts | See the event-reaction boundary below; never declassify protected values |
| `STAGE-ESM-030` | Named event-source or stream definition with a reserved stored name; unformattable routed fixtures or command replay routes. Routed read-model/query replay now renders. The default sandbox engine also reports it for every routed model | Rename the reserved name; render the model with `cratis render`, not `cratis run` |
| `STAGE-ESM-031` | Whole-number literal outside the C# `int` range below ESM v8 (v8 and later render `long`) | Raise the model to v8 constructs or gap-fill |
| `STAGE-ESM-032`, `-033` | Public events and event-target projections or reducers (ESM v9); foreign event origins and event-source captures | Gap-fill |
| `STAGE-ESM-034` | Reaction `runs as` invoking claim-reading or opaque authorization; every `runs as` on legacy syntax paths | Keep the gate; gap-fill |
| `STAGE-ESM-035` | Observer filters on legacy syntax paths; semantic reaction/reducer filters render | Use semantic admission |
| `STAGE-ESM-036` | Per-production route overrides | Gap-fill |
| `STAGE-ESM-041` | Non-text secret concepts (Int/Decimal/Bool/Date/DateTime/Uuid), not `pii secret` | Keep classification; text backing only if it preserves the contract |
| `STAGE-ESM-037` | Events and commands from one handler, even across separate triggers on the same event in one reaction. The scaffold's Arc supports mixed results, but appends events before commands; a refused command causes redelivery and duplicate events (Stage `v4.89.1:Documentation/reference/reaction-rendering.md:98`) | **Do not split the modeled reaction or drop an effect.** Gap-fill only with a proven retry-safe implementation; `[OnceOnly]` excludes replay, not retry |
| `STAGE-ESM-023` | Information: transition bodies analysed | none |
| `STAGE-CRATIS-001` to `-005` | Profile or `scene.json` not the package-owned shape; unrecognized or missing scaffold input; artifact path collision; a modeled module or feature that would render into the reserved `Customizations/` | Rename the module or feature (005) |
| `STAGE-AUTH-001` | Authorization cannot be rendered faithfully | As `STAGE-ESM-015` |
| `CLI-RENDER-001`, `-002` | Unknown target; invalid rendering name (`CLI-RENDER-003`, event generations, was reported by cratis 3.28.2 only) | Fix the option, or the model |
| `CLI-RENDER-004` | The bound model is newer than ESM v15 (CLI 3.57.0) | Not fixable by editing: keep the model, gap-fill |
| `CLI-RENDER-005`, `-006` | Authored metadata with characters invalid in XML blocks rendering of XML doc comments; a document set that cannot be read as a workspace renders without comments (warning) | Remove the invalid characters |
| `CLI-RENDER-007` to `-010` | `ui profile` refusals (package set, profile shape) | See `--package-set` |
| `CLI-RENDER-011` to `-014` | `--scope`: unknown address; ambiguous feature and slice name; aggregate or unrecognized policy layout (render the whole application once); a dependency not in the manifest or the scope | Fix the address or add the owning scope |

`CLI-RENDER-015` (navigation properties) is retired since Stage 4.73.1.

`STAGE-CRATIS-FILE-001`, `-INLINE-001`, `-QUERY-001`, `-KEY-001`, `-KEY-002`,
`-PROJECTION-001` and `STAGE-EVENT-001` come from the legacy syntax renderer and the direct
runtime route, not from `cratis render`.

**Legacy direct-write paths.** The syntax-based `IRenderer` and the optional
`Cratis.Stage.Rendering.Cratis.Scaffolding` package write straight to disk. Stage's README
states that direct rendering has no managed staging or safe stale-file removal and that a
failure can leave the target **unsafe and incomplete**. They are legacy compatibility
only; new rendering goes through `CratisRendering` and `cratis render`, whose managed
publication is journaled and recoverable.

## Projections

Stage renders two projection forms; the restrictions differ.

- **Identity and key rule** (the one place the full rule lives; other files point here).
  1. The identifier always equals the projection's effective key: the inline `key`, else the
     `from` block `key`, else the event source. An event-source key (default or
     `key $eventSourceId`) makes the identifier the event source; an event-property or literal
     key makes it that key. Stage refuses a literal key (`STAGE-ESM-017`; scoped keys are an
     event property or the event source, `SemanticScopedProjectionSupport.KeySupported`). Never map `$eventSourceId` onto the identifier when the key is
     something else (`from PaymentRecorded key invoiceId`): the runtime fails with "affected key
     disagrees with read-model identifier" (Screenplay v4.66.0
     `SemanticScopedProjection.State.cs:182-184`, `SemanticEvaluator.cs:733-736`).
  2. Executable model. A flat-bound projection must map the identifier like any required
     property (the flat evaluator does not seed it): `xId = <keyProperty>`. A scoped projection
     needs no mapping: `RootDocument` seeds the identifier from the key when it creates the
     instance (`SemanticScopedProjection.cs:279-290`). Mapping it from its key (`xId =
     $eventSourceId` for an event-source key, `xId = <keyProperty>` for an event-property key)
     is also valid.
  3. Renderable model (Stage v4.24.0). Binding flat (Screenplay `SemanticModelBinder.Projections.cs`
     `IsFlat`: every block is a `from` - no `remove`, join, children, nested, `every` or `all` -
     none has a parent key, every `from` is keyed by a top-level event property, and every
     mapping is a plain set to a declared top-level read-model property from a top-level event
     property or a non-null literal; `IsFlatSource`, `IsFlatProperty`) is not Stage admission.
     Every other shape binds scoped, including a `= null` clear or a dotted target.
- **Flat admission** (`SemanticCratisAdmission.StateView.cs:94-114`) holds only when all of these
  are true: one `from` naming one event (`STAGE-ESM-008`); every read-model property, optional
  ones included, is mapped from an event property (auto-map counts, and flat auto-map matches exact names only; a literal is refused,
  `STAGE-ESM-009`, `SemanticFlatProjectionSupport.MappingsMatch`); and the key property is an
  identifier concept that every producing command's `for` fills (`UsesEventSourceIdentity`).
  Anything else that binds flat is refused. When the key is the event source, drop the explicit
  key and the projection is scoped, which admits literals.
- **Scoped** (`SemanticScopedProjectionSupport.cs`, fixture `when_rendering_scoped_projections`):
  every other projection, including a plain single `from E` with the default or
  `$eventSourceId` key. Forms: several distinct `from` blocks, `remove with`, root
  `join ... on`, `children` with an identified element (one level, no children or joins
  inside a child; `remove with` and `remove via join` inside a child are admitted, fixture
  `when_executing_re_admitted_scoped_projections`, `children.RemovedWithJoin`), `nested` over
  an optional composite property, and `every` with set-from-event-source mappings. Keys are
  an event property or the event source. The key establishes the identifier, so it must end up
  unmapped: `Rejection` refuses a mapping onto it unless it copies the key's own event property
  (`MatchesKey`, `SemanticScopedProjectionSupport.cs:104-110, 360-363`), so an event-source key
  admits no mapping at all (`STAGE-ESM-017`). Auto-map counts as a mapping
  (Screenplay `SemanticModelBinder.ProjectionValues.cs` `AutoMapped`, which does not skip the
  identifier): if the event carries a property with the identifier's name and type, declare
  `no automap` and map the other properties explicitly. `from E` and `from E key
  $eventSourceId` render when the identifier ends up unmapped, whether or not the event repeats
  the identifier.
- Refused in a scope (`STAGE-ESM-017`): composite keys; `all` (FromAll); `every` with
  children included beside children or nested blocks; root `remove via join`; joins,
  children or join removals inside `nested`; a `clear` inside `nested`; recursive children
  and joins inside a child; duplicate event contracts among `from`, join or
  removal blocks; event or read-model property names that collide with Chronicle syntax.
  Several of these are tracked upstream (Chronicle#4125, #4166).
- A scope cannot also carry flat transitions.

The example in [render-example.md](render-example.md) uses a scope (`from` plus `remove with`).
Read-only reading of the source: a projection shape outside both forms is gap-fill, but
render it before saying so.

## Pure reducer bodies

Stage 4.24 renders a reducer only when each transition body passes a Roslyn analysis
against an audited allowlist: a complete statement block, pure operations over the typed
context, no directives, no writes to statics, `throw` limited to
`InvalidOperationException(string)` or `ArgumentException(string)`, LINQ lambdas that are
pure expressions, and no generated type shadowing a referenced one. Anything else is
`STAGE-ESM-019`, `-021` or `-022`. A reducer needs a `StateView` slice, its read model in the
same slice, a required Guid or text identifier and a matching keyed query. Code validation
(`STAGE-ESM-005`) is refused outright (opaque pure policies render at 4.73.1), and a command
`handler` never binds (`PLAY0268`). Reducer rendering was read, not run, for this skill.

## Specification rules (`STAGE-ESM-011`)

The following detailed rules retain the 4.24-era observations; current additions
are generated fixtures/return assertions, routed companion replay and supported single-hop
reaction appends (above). Other appends and commands cascading into reactions retain `-011`.
Sources: Stage `v4.89.1:Documentation/reference/generated-values-rendering.md:97-111`,
`Documentation/reference/event-source-routing.md:72`,
`Documentation/reference/reaction-rendering.md:63-75`.

From historical `SemanticSpecificationAdmission*.cs`; the first rule was also observed.

- A specification needs a `when <Command>` of its own slice (`PLAY0273` otherwise), and
  its `then` events must be as many as the command `produces` (observed: a `then query`
  spec failed until it also asserted the event).
- A `given caller` with a role-claim URI is refused; `role "X"` is accepted. `then denied`
  needs an authorized command and a `given caller`; a `then query` on a protected query
  needs a `given caller`.
- Admitted outcomes: `then <Event>` (ordered, or any order; duplicate contracts in any
  order are admitted for command-only assertions with compatible destinations, but not
  when a read-model or reducer expectation must replay them, which needs distinct
  contracts), `then readmodel`, `then query` (one result, scalar key), `then error` naming a
  rendered constraint or an authored message, `then denied`.
- Refused: `then no readmodel` (`STAGE-ESM-027`), an unauthenticated caller carrying roles or claims (`STAGE-ESM-011`), `when append`, composite values, `given readmodel` beside a
  command, error codes that name no rendered constraint, a `$context.occurred` mapping
  asserted without a supplied time, a query on a reducer-built read model, a protected
  query whose fixtures use streams other than the queried key.
- A when-less specification is admitted only as `then denied` on an authorized keyed
  query, or `given readmodel` plus `then query` on an unprotected query.
- Descriptions and event documentation render only as XML doc comments (Stage 4.73.1); comments are never rendered; neither is behavior.

## Observed refusals

Each came from the first draft of the example model, rendered with cratis 3.27.1 (the marina model still renders on 3.28.2 with 30 artifacts):

| Draft | Diagnostic | Fix that rendered |
| --- | --- | --- |
| `policy` with only `require role "HarbourMaster"` | `STAGE-ESM-015` | `require authenticated and role "HarbourMaster"` (two `require` lines are `PLAY0441`) |
| Projection `from BerthReserved` with `berthId = $eventSourceId` (mapping the identifier) | `STAGE-ESM-017`: mappings cannot overwrite the key | Do not map the identifier; the key establishes it, so map only the other properties. `from E key $eventSourceId` plus the same mapping was also refused |
| A `then query` spec in the view slice, then one without `then <Event>` | `PLAY0273`, then `STAGE-ESM-011` | Put the spec in the command slice with `given caller`, `when`, the `then` event and `then query` |

## Source disagreements (trust the code)

| Source says | Code at the tag says |
| --- | --- |
| Stage README: application scope adds "exactly eight" backend files | The scaffold creates nine (adds `GeneratedPolicyRegistration.cs`), plus the frontend scaffold |
| cli reference: bodied reducers are unsupported (`STAGE-ESM-019`) | `PureTransitionAdmission` admits pure allowlisted bodies |
| Stage customization guide: an Automation slice blocks with `STAGE-ESM-001`; Stage pins Screenplay 4.35.0 | With cli 3.27.1 an Automation or Translate slice failed binding (`PLAY0268`) first; with cli 3.28.2 it binds and Stage refuses the whole model with `STAGE-ESM-016` (probed). Stage 4.24.0 pinned Screenplay 4.60.0 (4.24.1: 4.66.0) |
| An earlier version of this skill: Stage has no authorization contract for queries | Query authorization is admitted and rendered; an unauthorized query renders `[AllowAnonymous]` (observed) |

## Historical Stage 4.24 admission

Kept as history. Not a statement about the current Stage (see the 4.89.1 summary in `SKILL.md` and the diagnostic codes above).

Whole-model admission needs ESM schema v1 to v4; v5 and v6 are `STAGE-ESM-016`. Stage 4.24.2 admits ESM v4 (Screenplay compiles a model with evolved events to v4): an event at its initial revision renders exactly as before, but any selected event above the initial revision, and every scope depending on it (a command producing it, a projection or reducer observing it, a specification using it), is refused with `STAGE-ESM-026` and nothing is emitted. A typed-context reference to a historical revision or property identity is refused with `STAGE-ESM-025`. Stage cannot render Chronicle event-type migrations yet (Cratis/Stage#204, which depends on Cratis/Screenplay#71), and Stage's runtime (`cratis run`, the Host) still refuses evolved events, so deliver evolved events as gap-fill. Stage 4.24.1 also lists the ESM v6 members (reactions, captures, application triggers, clock and capture specifications) as rejected `STAGE-ESM-024` in its surface ledger, but the version gate refuses the model first, so a v6 model reports `STAGE-ESM-016` only. The bundled Stage 4.24.2 (cratis 3.28.3) reports an evolved event with `STAGE-ESM-026` only (probed); cratis 3.28.2 bundled Stage 4.24.1 (3.28.1 and earlier: 4.24.0), refused a v4 model with `STAGE-ESM-016` and also reported `CLI-RENDER-003`. The admitted vertical:

- concepts, composite types, collections and optional values;
- `StateChange` slices with exactly one command and an unconditional `produces` whose
  `for` is the command identifier, with portable validation;
- `StateView` slices with exactly one projection (or reducer) per read model: a flat
  `from` block, or a scoped projection (several `from`, `remove with`, root `join`,
  one-level `children`, `nested`), keyed by the event source or an event property; and
  any number of optional snapshot queries by the read-model identifier;
- declarative authorization (including query authorization) that requires authentication;
- unique constraints, and modeled specifications that fit the shapes in the reference;
- reducers whose bodies pass the **pure** allowlist (Roslyn analysis).

Not rendered: `Automation` and `Translate` slices (Stage#79, open: the whole automation
is gap-fill), reactions and captures, list, observable, filtered and scoped queries,
`produces when`, command `handler`s, code validation and opaque policies (they refuse),
composite-key projections, `all`, and compliance markers (`pii`, `secret`, which
already fail binding with `PLAY0268`). Any one blocking diagnostic fails the whole plan.
A refusal is not a licence to weaken the model: drop no specification, event generation
or protection to get a render; keep the model, record the capability gap and gap-fill.
The code table, the projection and specification rules and the refusals reproduced while
building the example are in the sections above; the exhaustive ledger
is `references/renderable-subset.md` in `cratis-screenplay-toolchain`.
Read `cratis-screenplay-toolchain/references/renderable-subset.md` when you need the exhaustive surface ledger beyond the admission summary.

(At 4.24 descriptions and documentation were not rendered at all; since Stage#178 they render as XML doc comments only. Prose is still never enforced behavior.)
