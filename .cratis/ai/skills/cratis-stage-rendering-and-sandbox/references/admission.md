# Stage 4.24 admission: codes, specification rules and observed refusals

Read at Stage `v4.24.0` (`Source/Rendering.Cratis/CratisArtifactRenderPlanner.cs`,
`Semantics/SemanticCratisAdmission*.cs`, `SemanticSpecificationAdmission*.cs`,
`PureTransitionAdmission.cs`, `SemanticImplementationAdmission.cs`) and cli `v3.27.1`
(`Commands/Render/ScreenplayPlanning.cs`). Items marked *observed* were reproduced with
`cratis render` 3.27.1 while building [render-example.md](render-example.md). Anything else
is a reading of source: render the model before claiming it.

One blocking diagnostic fails the **whole** plan and nothing is published (exit 5).
Informational diagnostics (`PLAY0270` authoring metadata, `PLAY0469`, `STAGE-ESM-023`) do not.

A refusal can come from four layers, and the code tells you which: compilation and binding
(`PLAY*`, from the CLI's bundled Screenplay 4.60.1), execution planning (`PLAN-*`), Stage
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

## Diagnostic codes

| Code | Meaning | Usual fix |
| --- | --- | --- |
| `STAGE-ESM-001` | Slice kind other than `StateChange` / `StateView` (Automation, Translate; Stage#79) | Gap-fill the automation; the model stays the contract |
| `STAGE-ESM-002`, `-003` | Concept values or validation Stage cannot express; unresolved property type | Simplify the concept; fix the type |
| `STAGE-ESM-004` | A `StateChange` slice without exactly one command | One command per slice |
| `STAGE-ESM-005` | Code validation or rule predicate bodies; or a command beyond the first capability (optional event property, event revision other than the first, validation or requirement that cannot be rendered, no `produces`) | Use declarative validation; non-initial event generations are not rendered |
| `STAGE-ESM-006` | `produces` that cannot render without changing its destination or mappings (`produces when`, literal or computed mappings, `for` not a command identifier, mappings not one-to-one with event properties, duplicate tags) | Map properties one to one; conditional outcomes (`produces when`) are a different behavior, so gap-fill unless the owner accepts splitting them into commands |
| `STAGE-ESM-007`, `-008`, `-009` | Projection count per read model (exactly one projection or reducer each); unresolvable properties or no single read-model transition (**flat** projections only); affected instance not one, not keyed by an event property, or not the event-source identity (flat projections only) | One projection per read model; see "Projections" below |
| `STAGE-ESM-010` | A query is not an optional snapshot lookup by the read-model identifier (or its argument concept has validation); each query is checked on its own, so several such queries are admitted | Keyed `XById => X optional` queries; lists, observable and filtered queries are gap-fill |
| `STAGE-ESM-011` | A specification cannot render (see the rules below) | Reshape it only if the assertion keeps its meaning; otherwise keep the specification, record the gap, and gap-fill with the specification as the oracle. Never weaken or delete it to get a render |
| `STAGE-ESM-012` | Generated C# names collide (properties, types, namespaces, constraints) | Rename |
| `STAGE-ESM-013` | An event-context value other than `$context.occurred` mapped in `produces` | Map a command property when that preserves the meaning; otherwise gap-fill |
| `STAGE-ESM-014` | A constraint Chronicle cannot reproduce (kind, scope, message; multi-claim in one command; optional or composite targets) | A different constraint is a requirement change for the model owner; otherwise gap-fill |
| `STAGE-ESM-015` | Authorization Stage cannot render exactly: opaque (code) policy, role-claim URI, expression not requiring authentication, claim compared with a non-text value, authorized command without exactly one identifier | `require authenticated and ...`; text-backed claim targets |
| `STAGE-ESM-016` | Model language or semantic version is not ESM v1 to v3 (event generations are v4; v5 and v6 constructs also raise the version) | Not fixable by editing: the model needs a newer renderer. Keep the model, record the gap, gap-fill |
| `STAGE-ESM-017` | Read model or projection cannot render (property names that collide with Chronicle paths or expression syntax, mappings that overwrite the key or child identity, composite keys, `all`, the refused scope shapes below) | Reshape the projection without changing what it records, or record the gap |
| `STAGE-ESM-018` | `$strings.` key missing in the default locale or containing formatting characters | Fix the strings |
| `STAGE-ESM-019` | Reducer structure or body not admitted (outside a `StateView`, impure, does not compile) | An equivalent pure body, or gap-fill |
| `STAGE-ESM-020` | Implementation body missing, changed (hash differs) or refused by the loader | Provide the body inside the model root |
| `STAGE-ESM-021`, `-022` | Reducer typed-context or analysis failure; a construct outside the pure allowlist, or a generated name shadowing a reducer type | An equivalent pure body, or gap-fill |
| `STAGE-ESM-023` | Information: transition bodies analysed | none |
| `STAGE-CRATIS-001` to `-005` | Profile or `scene.json` not the package-owned shape; unrecognized or missing scaffold input; artifact path collision; a modeled module or feature that would render into the reserved `Customizations/` | Rename the module or feature (005) |
| `STAGE-AUTH-001` | Authorization cannot be rendered faithfully | As `STAGE-ESM-015` |
| `CLI-RENDER-001`, `-002`, `-003` | Unknown target; invalid rendering name; event generations (ESM v4) | Fix the option, or the model |

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
     disagrees with read-model identifier" (Screenplay v4.64.0
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
     mapping is a plain set from a top-level event property or a literal) is not Stage
     admission; every other shape binds scoped.
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
(`STAGE-ESM-005`) and opaque policies (`STAGE-ESM-015`) are refused outright, and a command
`handler` never binds (`PLAY0268`). Reducer rendering was read, not run, for this skill.

## Specification rules (`STAGE-ESM-011`)

From `SemanticSpecificationAdmission*.cs`; the first rule was also observed.

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
- Refused: `then no readmodel`, `when append`, composite values, `given readmodel` beside a
  command, error codes that name no rendered constraint, a `$context.occurred` mapping
  asserted without a supplied time, a query on a reducer-built read model, a protected
  query whose fixtures use streams other than the queried key.
- A when-less specification is admitted only as `then denied` on an authorized keyed
  query, or `given readmodel` plus `then query` on an unprotected query.
- Descriptions, comments and prose are never rendered.

## Observed refusals

Each came from the first draft of the example model, rendered with cratis 3.27.1:

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
| Stage customization guide: an Automation slice blocks with `STAGE-ESM-001`; Stage pins Screenplay 4.35.0 | With cli 3.27.1 an Automation or Translate slice fails binding (`PLAY0268`) first; Stage pins Screenplay 4.60.0 |
| An earlier version of this skill: Stage has no authorization contract for queries | Query authorization is admitted and rendered; an unauthorized query renders `[AllowAnonymous]` (observed) |
