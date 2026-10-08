# Renderable subset (V5): what `cratis render` admits

Sources, all read at tags: Stage v4.24.1 `Source/Rendering.Cratis/Semantics/SemanticSurfaceLedger.cs`
(an exhaustive map of every ESM member to Rendered, Rejected(code) or Ignored),
`CratisArtifactRenderPlanner.cs`, `PureTransitionAdmission.cs`; cli v3.28.2
`Commands/Render/RenderSettings.cs` and `Documentation/reference/screenplay.md`. Re-run the
render itself before claiming renderability: this table is a reading of the source, not a
render result.

Renderable is a strict subset of executable (`executable-subset.md`). Order of events in
`cratis render`: the CLI binds the model with its **bundled Screenplay** (4.66.0 in cratis 3.28.2, so PLAY0268
and friends appear first), then Stage admits or
rejects members. An ESM v6 model binds but Stage refuses it whole with `STAGE-ESM-016`
(probed on 3.28.2; an ESM v7 model with generated values or responses fails binding first on the bundled 4.66.0 with `PLAY0268`, and Stage 4.24.2 would refuse it with `STAGE-ESM-016` too, tracked in Stage#201; on before 3.28.2 it failed binding first, with PLAY0268).

## What Stage 4.24 admits

Models using `eventsource`, `stream` or command routes are not renderable: they fail
binding (`PLAY0268`) and Stage refuses their ESM version (`STAGE-ESM-016`); rendered
appends never carry event source type, event stream type or event stream id, so
Chronicle's defaults apply (Stage#177, #200, #201). See `sources-and-streams.md`.

Whole-model admission requires ESM schema v1 to v4 on Stage 4.24.2 (v1 to v3 on the 4.24.1 that cratis 3.28.2 bundled, where a v4 model was STAGE-ESM-016 and also failed the CLI pre-check CLI-RENDER-003; cratis 3.28.3 bundles 4.24.2); v5 and v6 are STAGE-ESM-016. On 4.24.2 a selected event above its initial revision, or any scope depending on it, is STAGE-ESM-026 (migrations are not rendered, Stage#204), and a historical typed-context reference is STAGE-ESM-025. The admitted vertical is concepts,
composite types, one command to its events, a one-instance projection, an optional keyed
snapshot query, declarative authorization (including query authorization) and modeled
specifications. **Automation and Translate slices are not rendered** (Stage#79, open): the
whole automation is hand-written (gap-fill).

| Area | Renders | Rejected (code) |
| --- | --- | --- |
| ESM version | schema v1 to v4 (4.24.2; initial-revision events only) | evolved events: STAGE-ESM-026 (4.24.2); historical references: STAGE-ESM-025; v5 `then no readmodel`, v6 constructs, v7 generated values and responses: STAGE-ESM-016 for the whole model (Stage 4.24.1 also ledgers the v6 members as `STAGE-ESM-024`; users still see STAGE-ESM-016) |
| Slice kinds | `StateChange`, `StateView` | `Automation`, `Translate`: STAGE-ESM-001 |
| Types | concepts over Uuid, String, Int, Decimal, Bool, Date, DateTime; composite types; collections; optional | unknown types: 002 and 003 |
| Validation | not empty, min, max, equal, not equal, comparisons, length, `all >`/`all >=`, matches, `$strings` keys (missing default keys: 018) | code rules and code validation: 005 |
| State change | exactly one command per `StateChange` (004); unconditional `produces` with property mappings; typed `for`; tags; requirements; portable authorization; `$context.occurred` | `produces when` (006); value or literal expressions (006); other `$context` and event-context values (013); `reads` (PLAY0271) |
| State view | one projection per read model (007); `from`, `join`, `children`, `nested`, `every`, removals; set, add, subtract, increment, decrement, clear | composite keys, `all` (FromAll), event-context values, join keys, literal mappings in `every`/`all`, derived event-property names (017); Many or ZeroOrOne affected-instance cardinality (009); root join removal and nested shapes are blocked by Chronicle#4125 and #4166 |
| Queries | only the ZeroOrOne snapshot lookup by the read-model identifier, plus authorization | lists, `One`, observable, live, filters, paging: 010 or PLAY0268 |
| Reducers | bodies that pass the pure-transition allowlist (Roslyn; 023 is information) | impure bodies: 019 to 022 |
| Constraints | unique property value, unique event occurrence; admitted even though Chronicle#4123 means index updates run after commit | intra-command multi-event change to one constraint; multi-claim in one command: 014 |
| Authorization | authenticated, role, claim and logical policies; caller fixtures; ownership claims against text-backed targets | opaque policy code, role-claim URIs, a claim matched against a Uuid-backed subject or path: 015 |
| Specifications | command-action scenarios: given events, `when <Command>`, `then` events (ordered or any order), `then readmodel`, `then query`, `then error` (naming a rendered constraint or message), `then denied`, `given caller`. Two narrow when-less routes: an unprotected single `then query` seeded by exactly one `given readmodel` whose key and values match (no given events, no caller), and a query-only denial (`given caller`, one `then query` with no results, `then denied`, a protected query, no role claims) | `then no readmodel`, `when append`, composite values, error codes not naming a rendered constraint: 011. Any other when-less specification (for example given events with `then query`) fails 011 |
| Compliance | none | any `@pii` or `@sensitive` already fails binding (PLAY0268). The C# provider mapping (Stage v4.29.0, Stage#197) is `@pii` to `[PII]`, `@sensitive` to `[Encrypted]` + `[NotAudited]`, both to `[PII]` only |

## Authoring consequences in renderable mode

- `produces when` is STAGE-ESM-006: split conditional outcomes into separate commands, or
  record the slice as non-renderable (gap-fill) without distorting a design-mode model.
- No `when append` specifications and no when-less event-replay proofs: prove a projection
  with a command-action scenario (given events, `when <Command>`, `then query` or `then
  readmodel`). The seeded when-less `then query` only checks a lookup over a given read-model
  state; it proves no projection (Stage `SemanticSpecificationAdmission.Callers.cs`).
- Use `$context.occurred` only; no `$context.identity.*` mappings.
- A list is a design-only query and blocks binding, and so rendering, of the whole application on its own. A keyed `XById` sibling does not change that: while any list query remains, nothing in the model binds, runs or renders. Keep a list the domain needs and report the capability gap.
- A `handler` (with or without `implementation` or `hint`) never binds; the slice is
  gap-fill, never "customized into" rendering.
- Descriptions and documentation are never rendered (Stage#178): a rule that exists only in
  prose is unenforced in rendered code.

## Ownership, publication and recovery

- Ownership is the destination's **`.cratis-render.json`** manifest (semantic revision,
  identities, path and SHA-256 per artifact) and the **`.cratis-render/`** control directory
  (`journal.json`, staging, backups). There are no in-file markers. Do not stage
  `.cratis-render/` in git.
- Recovery runs before planning. A result with `recovered: true` means stop and reconcile.
- `--force` replaces a *modified active managed* file only. It never overwrites unmanaged
  files and never deletes modified stale files.
- `--name` is **required** for plain source and sets the application identity (it also
  defaults the project name and root namespace). Attachments are read from the model root,
  so render from a dedicated model folder.
- `Customizations/` is reserved and unmanaged (STAGE-CRATIS-005 if a model would render into
  it). Seams: `Customizations/Program.cs` (partial `ConfigureServices` and
  `ConfigureApplication`), `Customizations/*.cs`, `Customizations/Dependencies.props`,
  `Customizations/styles.css`. The planner never reads it, and it never binds a modeled
  reaction or capture. A customization never makes a rejected model renderable.
- `cratis render` does **not** build, test or run the application.
- The scaffold pins .NET 10, Arc 22.25.0, Chronicle 19.8.1 and emits a `.frontend/` React/Vite
  app (Components 4.14.0, Scene 4.2.0). `Directory.Packages.props` is Stage-managed: do not
  edit it. `[ProtectedDecision]` (Arc v22.39.0) is not available in a rendered application.

## Reading V5

V5 is four separate results (admission, publication, build, tests), plus runtime when it
was exercised; formats and the Debug-only spec classes are in `verdicts.md`. Three cases
stay distinct: admission failure (nothing rendered); an existing generated base plus
separately authorized hand-written gap-fill; and a fully hand-written delivery. Never claim a
whole-application V5 from a subset. Drift: compare successive `.cratis-render.json`
`semanticRevision` values from renders with the same `--name` and inputs (see `versions.md`,
"Revisions and descriptions"); not the MCP `modelRevision`, not `open-workspace.revision`.

Workflow, gap-fill boundaries and recovery: `cratis-screenplay-render-and-gap-fill` and
`cratis-stage-rendering-and-sandbox`. The `cratis/stage` sandbox and the
`cratis/stage-specrunner` job are still shipped.
