---
name: cratis-stage-rendering-and-sandbox
description: "What Cratis Stage and `cratis render` do with a Screenplay `.play` model: the model shape Stage admits and refuses (`STAGE-ESM-*`, `PLAY0268` render refusals), what it emits (C# Arc/Chronicle backend, React/Vite scaffold with Arc `CommandForm` shell emission over Scene typed bindings, Debug specifications), managed publication, `--force`, recovery, scoped renders (`--scope`) and `--check`, authored-UI omission/parity checks, the unmanaged `Customizations/` seam, and the `cratis/stage` sandbox and `cratis/stage-specrunner` job. Use when deciding whether Stage can render a model, reading a blocked render, re-rendering safely, checking generated/runtime screen parity, or running the sandbox. Not for: authoring the model (use `cratis-screenplay-model-authoring`) or the render and gap-fill workflow (use `cratis-screenplay-render-and-gap-fill`)."
license: MIT
---

# What Stage renders, and what it refuses

Stage turns a Screenplay `.play` model into a Cratis Arc + Chronicle application. It
ships a **renderer** (a .NET library, driven from a terminal by `cratis render`), a
disposable **sandbox** container (`cratis/stage`, started by `cratis run`) and a
**specification runner** container (`cratis/stage-specrunner`).

The admitted model shape is deliberately small. A model Stage cannot render exactly
produces **no artifacts at all**, never thinner ones. Render the model to find out
whether it is admitted; reading the admission rules is not a render result.

Requires cratis CLI ≥ 3.57 (`cratis --version`) to render ESM v14 and v15 models; an older CLI refuses newer ESM versions with `CLI-RENDER-004` (or `STAGE-ESM-016` from Stage directly).

Requires Cratis CLI 3.74.0 to render ESM v21–v26 models (bundles Stage 4.135.0); CLI 3.66.0–3.73.0 refuse v21 and later with `CLI-RENDER-004`, and every CLI refuses v27 and later.

## Batches, described handlers, text rules and protected reads

Read [language admission](../cratis-screenplay-toolchain/references/language-admission.md)
for v22–v25: text rules render, atomic batches/protected reads/described bodies do
not. The semantic Host and specification runner execute admitted protected reads;
that is not rendering. Stub mode emits no described-body stubs. Keep protection and report refusal.

## When to use

- Deciding whether a model can be rendered, or reading a blocked render.
- Re-rendering safely after the model or a managed file changed.
- Checking what the generated UI does and does not prove.
- Running the sandbox or the specification runner, or a behavior walk.

Not for authoring the model (`cratis-screenplay-model-authoring`), the render and gap-fill
workflow (`cratis-screenplay-render-and-gap-fill`), or generated C# (`cratis-arc-command`, `cratis-chronicle-read-model`).

## Model-first rule

The `.play` model is the source of truth; Stage-managed output is derived from it.

- Change the model, then render again. Never edit a file listed in `.cratis-render.json`:
  the next render replaces it or refuses.
- Hand-written code goes in `Customizations/` (unmanaged), in a separate project, or in
  an explicitly authorized gap-fill for scope Stage cannot render (`cratis-screenplay-render-and-gap-fill`).
- A customization never makes a rejected model renderable, and never weakens modeled
  authorization, validation or personal-data and secret markers to get past a refusal.
- Never claim a whole-application result from a subset of the model.

## Render

```bash
cratis render ./model --name Marina --destination ./out
cratis render --workspace ./application.workspace.json --destination ./out
```

| Option | Meaning |
| --- | --- |
| `[PATH]` | A `.play` file or a folder (all `**/*.play`, one application). Defaults to the current directory; exclusive with `--workspace` |
| `--workspace <FILE>` | Canonical workspace envelope (Screenplay MCP `export-workspace`, at most 32 MiB). Keeps its application name and identities |
| `--name <NAME>` | **Required for plain source**, a C# identifier; sets the application identity (Chronicle event store, MongoDB database). With `--workspace` optional, and it must equal the workspace name |
| `--destination <DIR>` | Publication directory, default `./out`. It never defines identity |
| `--target` | Only `cratis` is bundled |
| `--project-name`, `--root-namespace` | Rendering overrides (dot-separated C# identifiers); do not change identity |
| `--scope <ADDRESS>` | Render only a module, feature or slice (`Module[.Feature…][.Slice]`, exact case); repeatable. See "Scoped renders" |
| `--check` | Plan against the real destination without writing: exit `0` current, `6` changes pending, `5` planning, refusal or pending recovery. Combine with `--scope` and `--force` |
| `--package-set <FILE>` | Approved package set (JSON) of custom runtime packages the `ui profile` may use; the frontend installs exactly these |
| `--force` | See "Publication and recovery" |

Order: recover any interrupted publication, compile, bind, build the plan, plan the target
(Stage admission), validate artifacts, then publish.
Exit `0` is a published render, `5` is a refusal with nothing published (diagnostics are
printed), `1` is a missing input. Add `-o json` for the counts and the publication receipt.

Facts that surprise:

- **Binding uses the CLI's bundled compiler**, not the standalone one. Version admission
  does not imply construct support: exact ESM v1–v21 and v23–v26 pairs are admitted,
  while v22/v27/v28 and mixed pairs refuse `STAGE-ESM-016`. Date/DateTime command comparisons (v26)
  execute in the semantic Host and executor but refuse `STAGE-ESM-046` in the renderer. Pattern/random generation and checksum validation
  render with an admitting renderer; `generate rule` still refuses `STAGE-ESM-028`.
  Read [references/admission.md](references/admission.md) for the introducing-release
  prerequisites, all-Proven unpinned specifications and construct/pin checks (-011/-038).
  An older CLI bundle can refuse `CLI-RENDER-004` (direct Stage: `STAGE-ESM-016`);
  keep refused models for gap-fill.
- **Render never builds, tests or runs** the output. A published render is admission and
  publication only; build and tests are separate results (see "Verify"). Admission can be
  green while a rendered Debug test fails (for example a query assertion on the key).
- **Implementation attachments are read from the model root**: the folder, or the single
  file's parent directory. Use a dedicated model folder. A required body that is missing
  or changed blocks the render with `STAGE-ESM-020`. A workspace envelope has no
  attachment root, so `file` references there fail the same way.
- `cratis render` and `cratis screenplay validate` are different gates: a model can
  validate and still refuse here.

### Scoped renders

`--scope` renders an admitted part while other slices wait for hand-written code or
renderer support. The whole model must still compile and bind, so a `PLAY0268`, protected
identity/enum, attached handler or unsupported ESM version anywhere blocks even a scoped render.
`PLAN-*` problems in unselected slices become warnings and `STAGE-ESM-*` refusals in
unselected slices do not block. A scoped plan has no application scaffold or default Scene
(with no manifest in the destination the plain scaffold is added). A dependency in another
slice must be rendered first or listed too (`CLI-RENDER-014`); unknown scope is `-011`,
ambiguous `-012`, aggregate policy layout `-013` (render the whole application once
first). Unselected managed files are preserved. A scoped result is evidence for that scope only.

## Publication and recovery

Read [publication and recovery](references/publication-and-recovery.md) before
publishing or using `--force`. Commit `.cratis-render.json`, never the
`.cratis-render/` control directory. Force never overwrites unmanaged files or
modified stale artifacts. Recovery runs before planning:
`recovered: true` means stop and reconcile. Use `--check` for drift, not MCP-to-manifest revision comparisons.

## Admission

One blocker publishes nothing. Codes, limits and fixes: [references/admission.md](references/admission.md).

- **Renders:** concepts/types/collections/optionals; portable StateChange and StateView slices,
  flat/scoped projections, pure reducers and reducer `from` filters; keyed optional snapshots,
  observable lists with equality filters; portable authorization and unique constraints; v8 sources/streams/routes
  and routed companion replay; case tables, `long` whole numbers and enum numbers; required
  scalar UUID/String generation strategies and v15 freshness, responses and fixtures; concept
  compliance; supported event-triggered Automation with `runs as`/`from` as `[OnceOnly]` reactors;
  single-hop reaction append specifications, Debug specifications and authored UI through Scene.
- **Refused:** Translate/captures, non-event triggers, opaque bodies and clock specs (`STAGE-ESM-024`);
  mixed effects (`STAGE-ESM-037`, redelivery duplicates events); unsupported reaction mappings (`-039`),
  protected identities/enums (`-040`); unsupported generated types/results (`-028`/`-038`);
  appends beyond single-hop/cascade specs (`-011`), absence (`-027`), evolution (`STAGE-ESM-026`), public/foreign events
  (`-032`/`-033`), claim-reading/opaque `runs as` gates (`-034`), legacy filters (`-035`), production
  overrides (`-036`), code validation (`-005`), DateTime filters (`-010`),
  unsupported conditional productions, composite projection keys and unsupported `all` shapes.
  The Cratis C# renderer refuses protected reads with `STAGE-ESM-044`, described handlers `STAGE-IMPL-002`
  (even Stub mode), and atomic mode in admitted pairs `STAGE-ESM-043`.
- **Binding refusals (`PLAY0268`/`PLAY0271`):** legacy reads, `concurrency`, attached
  handlers, context/single-result filters, opaque scope/performer, a list-query `by` block,
  enum/identity compliance and subject lineage. Eligible protected reads bind v25;
  pending handlers with unconditional productions bind v23, but neither renders. A read model with several key parts (v27) refuses `STAGE-ESM-016`.
  Never drop protection.

A refusal is not a licence to weaken the model: drop no specification, event generation or
protection to get a render; keep the model, record the capability gap and gap-fill.

**Descriptions and documentation render only as XML documentation comments** (`<summary>`,
`<remarks>`), never as validation, authorization or behavior, so a rule that exists only in
prose is not enforced. A documentation edit changes managed-file hashes (a `--check` exit
`6`), and characters invalid in XML block rendering with `CLI-RENDER-005`.

Generated identities: read [shop strategy choices](references/choosing-generation.md) before
rendering a model with generated values. Case tables and whole numbers:
[case tables and whole numbers](references/case-tables-and-whole-numbers.md).
`[ProtectedDecision]` and `DecisionRead<T>` are available to gap-fill code, not
automatically emitted or protected by Stage; admission and unit-of-work enrollment still matter.

## What it emits

At application scope the plan holds the scaffold plus the modeled artifacts: a `.csproj`
and `.slnx`, `Program.cs`, `appsettings.json`, `docker-compose.yml`, the Directory props
files, a policy registration and generated policies, `Common/<Concept>.cs`, one
`<Module>/<Feature>/<Slice>/` folder per slice with the `[Command]` record and `Handle()`,
the `[EventType]` event, the validator and the `[ReadModel]` with its query, `scene.json`,
and a React/Vite frontend scaffold (`.frontend/`, `package.json`, `tsconfig.json`,
`.gitignore`). Per-file detail, the scaffold's dependency set and the `Customizations/`
contract, including the opt-in self-reducing layout for confirmed new Cratis C# applications:
[references/rendered-application.md](references/rendered-application.md). Scene
package ids, host capabilities and the boundary from hand-built Components pages:
[references/scene-runtime.md](references/scene-runtime.md). A complete renderable model:
[references/render-example.md](references/render-example.md).

Modeled specifications become xunit classes compiled in **Debug only**
(`IsTestProject` when Debug): a command spec `when_<snake>` in namespace
`<slice namespace>.when_<snake>` (so `when_x.when_x`), queries `when_<snake>_is_queried`,
read models `when_<snake>_is_projected`. A case table expands to one class per case
(`<Specification>_<Case>`).

### UI parity

The scaffold emits Arc `CommandForm` shells over Scene typed bindings, with `scene.json`
and `src/bindings.ts` registering the modeled commands and queries. Record what the
generated output claims separately from what the model authored, and claim UI fidelity
only from a browser run. Require a generated plan entry, manifest entry or artifact for
each screen, template, form, toolbar, component, outlet, route and package-icon use, or a
blocking diagnostic explaining why it was not generated. `STAGE-SCENE-ACTION-001` and
`STAGE-SCENE-INTERACTION-001` refuse a guard Stage cannot evaluate: no artifacts.
Silent fallback to a default screen is a failure, not a partial render.

## Sandbox and specification runner

`cratis run [PATH]` (Docker required) starts `cratis/stage` on the folder or file: Stage
API on `9090`, Chronicle Workbench on `https://localhost:35000`. It is a **partial,
disposable runtime**, not a generated application. The default engine appends modeled
`produces` facts and echoes the payload. It refuses missing required properties and
simple literal `validate` rules on top-level properties, but enforces no other rule, no
constraint and no command or query authorization; `Stage__Runtime__Engine=semantic` opts
in to an engine that does, and refuses what it cannot execute (HTTP 501). The default engine
also refuses routed models (`STAGE-ESM-030`) and protected reads (`STAGE-ESM-044`).
Requires Stage 4.129.0 for semantic Host/runner protected reads; older engines refuse
`STAGE-ESM-044`. Required absence rejects before requirements/generation, read properties
feed requirements and productions, and non-Error protected requirements refuse
`STAGE-ESM-045`, including reaction invocations. The Host faults on any outside append,
even unrelated facts; this is stricter than reference dependency-scoped conflicts.
Callers are built from unsigned headers, so
authorization there is not a security boundary.

`cratis/stage-specrunner` checks modeled specifications and writes a results file. The
default `structural` engine is deprecated and model-level only; `--engine semantic`
executes admitted specs through Arc's in-memory pipeline and reports `Passed`, `Failed`,
`Unsupported` or `Cancelled`. A green result is Stage semantic-engine evidence: not V4 and
not a rendered Debug test run. Commands, the report schema and limits:
[references/sandbox-and-specrunner.md](references/sandbox-and-specrunner.md).

Specification runner exit codes: `0` means the run completed and the results file was
written **even when a specification failed**, so read the outcomes; `1` is a missing or
uncompilable input; `2` a missing required argument or an invalid semantic option.

## Behavior walk (optional, after V3)

Walk each persona's commands and screens in the sandbox's semantic engine and record what
changes, when a domain expert should check the model by using it. It yields findings for
the model owner only, changes nothing, is not UI review and is not V4 or V5 evidence.
Prerequisites, the walk, finding kinds, limits and hand-off:
Read [references/behavior-walk.md](references/behavior-walk.md) when planning or running it.

## Legacy direct-write rendering

The syntax-based `IRenderer` and `Cratis.Stage.Rendering.Cratis.Scaffolding` write directly
to disk with no managed staging and no safe stale-file removal; a failure can leave the target unsafe and incomplete. Use `cratis render`.

## Verify

- `cratis render` exits 0 and reports `recovered: false`, with `written + unchanged`
  equal to the artifact count (for `--scope`, the scope's artifacts); otherwise the render is not a
  result. State the scope in the V5 report.
- Report V5 as separate results, each a result or "not run": admission, publication,
  Debug build (`dotnet build <destination>/<Project>.csproj -c Debug`), Debug tests
  (`dotnet test` on the same project) and runtime. Render alone is the first two.
- A refusal is kept verbatim as reported: `PLAY*` (compile or bind), `PLAN-*` (execution
  plan), `STAGE-*` (admission), `CLI-RENDER-*`, or a plain ownership error for a managed
  file. The fix is an intent-preserving model change or a recorded gap, never an edit of
  managed output and never a weakened model.
- No file under `.cratis-render/` is staged; managed files carry no local edits.
- Stage's plan is deterministic (same bytes and hashes); that is not a review, and Stage never reviews, stages or approves anything.
- Sandbox expectations account for the rules, constraints, authorization and query
  authorization the default engine does not enforce.
- Runtime screen smoke coverage uses the same model root or workspace export as
  `cratis render`, names package/image versions, and fails on dropped authored UI
  or silent default composition.

## Route near misses

Read [references/neighbouring-skills.md](references/neighbouring-skills.md) when the work is authoring or checking the model, tooling, the render workflow, generated C# or the Chronicle store.
