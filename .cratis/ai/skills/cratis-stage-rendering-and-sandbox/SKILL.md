---
name: cratis-stage-rendering-and-sandbox
description: "What Cratis Stage and `cratis render` actually do with a Screenplay `.play` model today: the model shape the current Stage admits and refuses (`STAGE-ESM-*`, `PLAY0268` render refusals), what it emits (C# Arc/Chronicle backend, React/Vite scaffold with Arc `CommandForm` shell emission over Scene typed bindings, Debug specifications), managed publication, `--force`, recovery, scoped renders (`--scope`) and `--check`, authored-UI omission/parity checks, the unmanaged `Customizations/` seam, and the `cratis/stage` sandbox and `cratis/stage-specrunner` job. Use when deciding whether Stage can render a model, reading a blocked render, re-rendering safely, checking generated/runtime screen parity, or running the sandbox. Not for: authoring the model (use `cratis-screenplay-model-authoring`) or the render and gap-fill workflow (use `cratis-screenplay-render-and-gap-fill`)."
license: MIT
---

# What Stage renders, and what it refuses

Stage turns a Screenplay `.play` model into a Cratis Arc + Chronicle application. It
ships a **renderer** (a .NET library, driven from a terminal by `cratis render`), a
disposable **sandbox** container (`cratis/stage`, started by `cratis run`) and a
**specification runner** container (`cratis/stage-specrunner`).

Stage is experimental and its admitted model shape is small. A model it cannot render
exactly produces **no artifacts at all**, never thinner ones. Read the admission rules
before promising that a model can be rendered, and render it to find out: the source
reading in this skill is not a render result.

Authored UI has its own parity hazard. Historically (Stage 4.24) Stage rendered a default React/Vite
scaffold and did not prove that modeled screens, templates, forms, toolbars,
components, outlets, package icons or routes were implemented. The first fully
passing public browser vector was CLI 3.40.7 with `cratis/stage:4.51.1`: 51
browser assertions passed, none blocked or pending (Cratis/Screenplay#605).
Native command forms, required fields, scoped comments, deep links,
stale-response handling and theme all pass there. On public CLI 3.43.0 (default
`cratis/stage:4.52.0`) an agent-edited table column was rendered, run and seen in
the browser. Two behaviors stay fail-closed by design: a guarded Close action
(`STAGE-SCENE-ACTION-001`) and a double-click interaction
(`STAGE-SCENE-INTERACTION-001`) are refused and recorded as unsupported
capabilities, never emulated. Require a generated plan or artifact entry for every
authored UI construct, and report every unsupported UI directive as a diagnostic.
Silent fallback to a default screen is a failure, not a partial render.

## Specification runner exit codes

`cratis/stage-specrunner` exit `0` means the run completed and the results file was written **even when a specification
failed**: read the outcomes. `1` is a missing or uncompilable input, `2` a missing required
argument or an invalid semantic option.


## Verified product sources

Current pins and the tool split: `cratis-screenplay-toolchain/references/versions.md`. Facts here
were read at Stage `v4.73.1` (`Source/Rendering.Cratis/**`, `Documentation/guides/build-renderer-target.md`,
`Documentation/reference/render-plans.md`, `Documentation/docker/**`) and cli `v3.53.1`
(`Documentation/reference/screenplay.md`, `Source/Cli/Commands/Render/**`), not by a render run
unless a line says *observed*. CLI 3.53.1 bundles Screenplay 4.137.0 and Stage 4.73.1, so its
binder is behind the standalone 4.139.0 compiler. Stage 4.73.1's scaffold pins Arc 22.68.0, Chronicle 19.45.0, Components 4.26.2, Scene 4.21.0 and
Fundamentals 7.22.8. These are **not** the latest releases; do not bump them in managed files
([rendered application](references/rendered-application.md)).

Historical executed baselines (history, not current claims): Stage `v4.24.2` and cli
`v3.28.2`/`v3.28.3` (Cratis/cli#253; the example in [render-example.md](references/render-example.md)),
cli 3.40.7 with Stage 4.51.1 (first fully passing browser vector, Cratis/Screenplay#605) and
CLI 3.43.0 with Stage 4.52.0. Case tables (Stage 4.59.0+) and whole numbers as `long` from ESM v8
(4.61.0+) apply to the current default; the pinned Stage default applies both rules. The Stage
4.52.0 renderer applies neither new rule.

`[ProtectedDecision]` and `DecisionRead<T>` are available to gap-fill code, not automatically
emitted or protected by Stage; admission and unit-of-work enrollment still matter. Studio 0.144.4 is
released, but production answers every unauthenticated request with 401, so Studio production
Play proof is not claimed.

## Model-first rule

The `.play` model is the source of truth; Stage-managed output is derived from it.

- Change the model, then render again. Never edit a file listed in `.cratis-render.json`:
  the next render replaces it or refuses.
- Hand-written code goes in `Customizations/` (unmanaged), in a separate project, or in
  an explicitly authorized gap-fill for scope Stage cannot render (`cratis-screenplay-render-and-gap-fill`).
- A customization never makes a rejected model renderable, and never weakens modeled
  authorization, validation or personal-data and secret markers to get past a refusal.
- Never claim a whole-application result from a subset of the model.

## Publication and recovery

Ownership is the destination's **`.cratis-render.json`** manifest (semantic revision,
identity, path and SHA-256 per artifact); there are no in-file markers. Interrupted
commits are journaled in the **`.cratis-render/`** control directory (journal, staging,
backups). Never stage `.cratis-render/` in git; commit the manifest with the output.

- An unmanaged file at a planned path is refused, even with `--force`.
- A user-modified managed file is refused unless it is still active **and** `--force` is
  given; `--force` replaces it. It never overwrites unmanaged files and never deletes a
  modified stale file. A stale managed file is removed only if its bytes still match.
- Recovery runs before planning, even when planning then fails. **`recovered: true` in the
  result means stop and reconcile**: the receipt does not describe what recovery changed.
- An unchanged re-render writes nothing (`unchanged` equals the artifact count).
- Use exclusive access to the destination; a receipt is a filesystem result, not a Git
  commit, and the command creates no branch, commit or PR.
- Drift: `cratis render ... --check` (CLI 3.44.0 or later) is the first probe; exit `6` means
  pending changes. Otherwise compare successive manifests' `semanticRevision` for renders with the
  same `--name` and inputs. Do not compare the MCP `modelRevision` with the manifest: their
  application identities can differ.

## Rendering with `cratis render`

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

### Scoped renders

`--scope` (CLI 3.49.0 or later) renders an admitted part while other slices wait for hand-written
code or renderer support. The whole model must still compile and bind, so a `PLAY0268`, `pii`/`secret`,
handler or ESM v11+ problem anywhere blocks even a scoped render. `PLAN-*` problems in unselected
slices become warnings and `STAGE-ESM-*` refusals in unselected slices do not block. A scoped plan
has no application scaffold or default Scene (with no manifest in the destination the plain scaffold
is added). A dependency in another slice must be rendered first or listed too (`CLI-RENDER-014`);
unknown scope `-011`, ambiguous `-012`, aggregate policy layout `-013` (render the whole application
once first). Unselected managed files are preserved. A scoped result is evidence for that scope only.

Order of events: recover any interrupted earlier publication, compile, bind, build the
execution plan, plan the target (Stage admission), validate artifacts, then publish.
Exit `0` is a published render, `5` is a refusal with nothing published (diagnostics are
printed), `1` is a missing input. Add `-o json` for the counts and the publication
receipt.

Facts that surprise:

- **Binding uses the CLI's bundled Screenplay** (4.137.0 in cratis 3.53.1; the standalone tool is
  newer). A model that binds is not necessarily renderable: Stage 4.73.1 admits ESM v1 to v10 by
  version, then refuses each construct it does not render with its own code (below). v11 or newer is
  `CLI-RENDER-004`; direct Stage reports `STAGE-ESM-016`.
- **Render never builds, tests or runs** the output. A published render is admission and
  publication only; build and tests are separate results (see "Verify"). Admission can be
  green while a rendered Debug test fails (the example hit this with a query assertion).
- **Implementation attachments are read from the model root**: the folder, or the single
  file's parent directory. Use a dedicated model folder. A required body that is missing
  or changed blocks the render with `STAGE-ESM-020`. A workspace envelope has no
  attachment root, so `file` references there fail the same way.
- `cratis render` and `cratis screenplay validate` are different gates: a model can
  validate and still refuse here.

## Current admission (Stage 4.73.1)

Source reading, not a render run. One blocking diagnostic fails the whole selected scope and
publishes nothing. Codes and fixes: [references/admission.md](references/admission.md); the
exhaustive ledger is `cratis-screenplay-toolchain/references/renderable-subset.md`.

- **Renders:** concepts, composite types, collections, optionals; `StateChange` slices (one command,
  unconditional `produces`, portable validation); `StateView` slices with flat or scoped
  projections and pure reducers (reducer `from` filters render); keyed optional snapshot queries and
  **observable** list queries (keyed or unkeyed); authorization (role-only, authenticated, opaque
  pure policies, claim conditions, `not`/and/or; roles read through the identity's `RoleClaimType`);
  unique constraints; named event sources, streams and routes (ESM v8); case tables; whole numbers
  as `long`; modeled specifications as Debug xunit classes; authored UI through Scene.
- **Refused with a code:** `Automation` and `Translate` slices, reactions, captures, triggers and clock
  specifications (`STAGE-ESM-024`); a reaction that both produces events and invokes commands
  (`STAGE-ESM-037`); generated command values (`-028`) and responses (`-029`); `then no readmodel` (`-027`);
  evolved events (`-026`); public events and event-target projections (`-032`); foreign origins and
  event-source captures (`-033`); reaction `runsAs`, `from` filters and per-production route overrides
  (`-034`, `-035`, `-036`); code validation (`-005`); a non-observable list query (`-010`);
  `produces when`, composite-key projections, `all`. Reducer filters render. The CLI/Stage pair reaches
  construct checks through v10; a bound v11 model is `CLI-RENDER-004`.
- **Refused at binding (`PLAY0268`/`PLAY0271`):** `reads`, `concurrency`, command `handler`s,
  `filter`, `scoped to`, `performer` and composite `by` queries, `pii`/`secret` compliance markers.

A refusal is not a licence to weaken the model: drop no specification, event generation or
protection to get a render; keep the model, record the capability gap and gap-fill. The 4.24-era
admission (ESM v1 to v4, keyed optional queries only) is kept as history in `references/admission.md`.

**Descriptions and documentation render only as XML documentation comments** (`<summary>`,
`<remarks>`; Stage#178 closed), never as validation, authorization or behavior, so a rule that exists
only in prose is not enforced. A documentation edit changes managed-file hashes (a `--check` exit
`6`), and characters invalid in XML block rendering with `CLI-RENDER-005`.

## What it emits

At application scope the plan holds the scaffold plus the modeled artifacts, for the
example 30 files on cratis 3.28.2 (56 observed on 3.53.1): a `.csproj` and `.slnx`, `Program.cs`, `appsettings.json`,
`docker-compose.yml`, the Directory props files, a policy registration and generated
policies, `Common/<Concept>.cs`, one `<Module>/<Feature>/<Slice>/` folder per slice with
the `[Command]` record and `Handle()`, the `[EventType]` event, the validator and the
`[ReadModel]` with its query, `scene.json`, and a React/Vite frontend scaffold
(`.frontend/`, `package.json`, `tsconfig.json`, `.gitignore`). Per-file detail, the
scaffold pins and the `Customizations/` contract are in
[references/rendered-application.md](references/rendered-application.md).
Read `references/rendered-application.md` when inspecting scaffold pins, managed-file ownership, or implementing a `Customizations/` extension.

Modeled specifications become xunit classes compiled in **Debug only**
(`IsTestProject` when Debug): a command spec `when_<snake>` in namespace
`<slice namespace>.when_<snake>` (so `when_x.when_x`), queries `when_<snake>_is_queried`,
read models `when_<snake>_is_projected`.

Stage 4.59.0+ expands a case table to effective `<Specification>_<Case>` names
and one generated class per case; normalized path collisions refuse the plan
with `STAGE-CRATIS-004`. Failed case results include the case and effective fixtures.
Stage 4.61.0+ renders whole numbers as `long` from ESM v8, retains `int` below
v8 and refuses out-of-`int` literals there with `STAGE-ESM-031`. The pinned Stage default applies both rules;
pins: toolchain `references/versions.md`. Previous CLI 3.46.1's
Stage 4.52.0 renderer applies neither new rule. Read
[case tables and whole numbers](references/case-tables-and-whole-numbers.md)
for complete examples, stored-schema consequences and the sandbox-only `--tag` override.

For UI, record what the generated output claims separately from what the model
authored. Before CLI 3.40.7 the generated scaffold was not screen parity evidence.
On public CLI 3.43.0 / `cratis/stage:4.52.0` the canonical corpus publishes,
`scene.json` contains Arc `commandForm` components, `src/bindings.ts` registers
the modeled commands and queries, and the browser acceptance run passes. That is
not Studio production proof. Require an explicit plan, manifest entry or
generated artifact for each
screen/template/form/toolbar/component/outlet/route/package-icon use, or a
blocking diagnostic explaining why it was not generated.

## Sandbox and specification runner

`cratis run [PATH]` (Docker required) starts `cratis/stage` on the folder or file: Stage
API on `9090`, Chronicle Workbench on `https://localhost:35000`. It is a **partial,
disposable runtime**, not a generated application. The default engine appends modeled
`produces` facts and echoes the payload but enforces no modeled validation or
authorization and no query authorization; `Stage__Runtime__Engine=semantic` opts in to
an engine that does, and refuses what it cannot execute (HTTP 501). At Stage 4.73.1 the default
engine also refuses routed models (`STAGE-ESM-030`) and the structural runner is deprecated (details:
the sandbox reference). Callers are built
from unsigned headers, so authorization there is not a security boundary.

`cratis/stage-specrunner` checks modeled specifications and writes a results file. The
default `structural` engine is deprecated and model-level only; `--engine semantic`
executes admitted specs through Arc's in-memory pipeline and reports `Passed`, `Failed`,
`Unsupported` or `Cancelled`. A green result is Stage semantic-engine evidence: not V4 and not a rendered Debug test run. Commands,
the semantic report schema and limits: [references/sandbox-and-specrunner.md](references/sandbox-and-specrunner.md).
Read `references/sandbox-and-specrunner.md` before launching either container or interpreting specification-runner outcomes.

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
- No claim that Stage reviewed, staged or approved anything; its plan is deterministic
  (same input, same bytes and hashes), which is not a review.
- Sandbox expectations account for unenforced validation, authorization and query
  authorization on the default engine.
- Runtime screen smoke coverage uses the same model root or workspace export as
  `cratis render`, names package/image versions, and fails on dropped authored UI
  or silent default composition.

## Route near misses

- Writing or checking the `.play` model: `cratis-screenplay-model-authoring` (compiler and
  MCP), `cratis-screenplay-event-modeling` (method), and the per-surface
  `cratis-screenplay-*` skills.
- Which tool says what, versions and diagnostics: `cratis-screenplay-toolchain`.
- Running the render workflow end to end, gap-fill and the field ledger:
  `cratis-screenplay-render-and-gap-fill`.
- Understanding the generated command, validator or read model as C#: `cratis-arc-command`
  and `cratis-chronicle-read-model`; checking hand-written code against its slice:
  `cratis-application-slice-conformance`.
- Inspecting the Chronicle store the sandbox writes into: `cratis-chronicle-cli-operations`
  and `cratis-chronicle-web-workbench`.

## Legacy direct-write rendering

The syntax-based `IRenderer` and the optional `Cratis.Stage.Rendering.Cratis.Scaffolding`
package write directly to disk, with no managed staging and no safe stale-file removal; a
failure can leave the target unsafe and incomplete. They are legacy compatibility only.
Use `cratis render` (journaled, recoverable publication) instead.

## Lineage

Rewritten for #493. The earlier version described Stage 3.15.1 (no CLI, eight-file
backend scaffold, `not empty`-only validation, no frontend, Arc 22.3.0); each claim was
re-verified at Stage 4.24.0 and cli 3.27.1 and replaced, then re-run on Stage 4.24.1 and cli 3.28.2 and on Stage 4.24.2 and cli 3.28.3 (an evolved event reports `STAGE-ESM-026`). See
[references/admission.md](references/admission.md) for source disagreements.
