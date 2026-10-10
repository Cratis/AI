---
name: cratis-stage-rendering-and-sandbox
description: "What Cratis Stage and `cratis render` actually do with a Screenplay `.play` model today: the narrow model shape Stage 4.52 admits and refuses (`STAGE-ESM-*`, `PLAY0268` render refusals), what it emits (C# Arc/Chronicle backend, React/Vite scaffold with Arc `CommandForm` shell emission over Scene 4.12 typed bindings, Debug specifications), managed publication, `--force` and recovery, authored-UI omission/parity checks, the unmanaged `Customizations/` seam, and the `cratis/stage` sandbox and `cratis/stage-specrunner` job. Use when deciding whether Stage can render a model, reading a blocked render, re-rendering safely, checking generated/runtime screen parity, or running the sandbox. Not for: authoring the model (use `cratis-screenplay-model-authoring`) or the render and gap-fill workflow (use `cratis-screenplay-render-and-gap-fill`)."
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

Authored UI has its own parity hazard. Stage 4.24 rendered a default React/Vite
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

| Source | Pin | Notes |
| --- | --- | --- |
| Stage | `4.52.0` (`v4.52.0`, `0e4fd87`) as the CLI 3.43.0 default; latest public package `4.57.0` (`3b8049f`) | Renderer, sandbox host, spec runner; the CLI default image is `cratis/stage:4.52.0`. Both define `STAGE-SCENE-ACTION-001` and `STAGE-SCENE-INTERACTION-001`. Earlier executed baselines: 4.51.3, 4.51.1, 4.49.5 and `v4.24.2` (`32dcac4`) |
| cratis CLI | `3.43.0` (`v3.43.0`, `23e5a24`) | `cratis render`, `cratis run`; the tag pins `StageVersion` 4.52.0 and `ScreenplayVersion` 4.127.0. The public CLI renders the canonical corpus and runs the stdio MCP transcript; refusing an unresolvable UI profile and recovering a rendered application shipped in Cratis/cli#301. Older baselines: 3.41.0, 3.40.7, `v3.28.2` (`141c499`, Cratis/cli#253) |
| Screenplay | bundled `4.127.0`; latest public language package `4.129.0` | The CLI bundles 4.127.0, so compiler claims made through `cratis` are 4.127.0 claims; use the standalone 4.129.0 tool only for language features newer than the bundle |
| Rendered applications | Arc, Chronicle, Scene 4.15.0, .NET 10 | CLI 3.43.0 renders the canonical corpus to `.cratis-render.json`, backend artifacts, `.frontend/**`, `scene.json`, `src/bindings.ts`. Verify the generated package set for each render before claiming exact Scene runtime parity |

Everything below was read at those tags (`Source/Rendering.Cratis/**`, `README.md`,
`Documentation/**` in Stage; `Source/Cli/Commands/Render/**` and
`Documentation/reference/screenplay.md` in the CLI), and the vertical in
[references/render-example.md](references/render-example.md) was rendered, built and
tested with cratis 3.28.2 (re-run on 3.28.3). Read `references/render-example.md` when you need a complete renderable model and the observed render, build, and test results. The full version table (Screenplay 4.66.0, Arc 22.50.5,
Chronicle 19.32.0 and the tool split) is in the `cratis-screenplay-toolchain` skill,
`references/versions.md`. Stage 4.51.3 scaffolds Arc `22.50.5` and Chronicle
`19.32.0`, with `CratisEmbeddedScreenplayEnabled=false`. `[ProtectedDecision]` and
`DecisionRead<T>` are available to gap-fill code, not automatically emitted or
protected by Stage; admission and unit-of-work enrollment still matter. See
[rendered application](references/rendered-application.md) for the source checks. Screen render
publication and browser behavior for the canonical corpus are verified on public
CLI 3.43.0 / `cratis/stage:4.52.0`. Studio 0.144.4 is released, but production
answers every unauthenticated request with 401 and the production UI automation
needs a
test-account decision, so Studio production Play proof is not claimed.

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
- Drift: compare successive manifests' `semanticRevision` for renders with the same
  `--name` and inputs. Do not compare the MCP `modelRevision` with the manifest: their
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
| `--force` | See "Publication and recovery" |

Order of events: recover any interrupted earlier publication, compile, bind, build the
execution plan, plan the target (Stage admission), validate artifacts, then publish.
Exit `0` is a published render, `5` is a refusal with nothing published (diagnostics are
printed), `1` is a missing input. Add `-o json` for the counts and the publication
receipt.

Facts that surprise:

- **Binding uses the CLI's bundled Screenplay** (4.66.0 in cratis 3.28.2, the same compiler
  as the standalone tool, ESM up to v6). A v6 model (Automation, Translate, reactions,
  captures, application triggers, clock specifications) binds and is then refused whole by
  Stage with `STAGE-ESM-016` (probed on 3.28.2); on cratis before 3.28.2 the bundled
  4.60.1 binder stopped it first with `PLAY0268`. A model that binds is not necessarily
  renderable: Stage admits ESM v1 to v4, and a v4 model renders only while no selected
  event has evolved (`STAGE-ESM-026`, Stage 4.24.2).
- **Render never builds, tests or runs** the output. A published render is admission and
  publication only; build and tests are separate results (see "Verify"). Admission can be
  green while a rendered Debug test fails (the example hit this with a query assertion).
- **Implementation attachments are read from the model root**: the folder, or the single
  file's parent directory. Use a dedicated model folder. A required body that is missing
  or changed blocks the render with `STAGE-ESM-020`. A workspace envelope has no
  attachment root, so `file` references there fail the same way.
- `cratis render` and `cratis screenplay validate` are different gates: a model can
  validate and still refuse here.

## Historical Stage 4.24 admission

Current pins are standalone Screenplay 4.127.0 / CLI 3.41.0 / Stage 4.51.3.
Routes bind/reference-execute as v8; reaction `runs as` identity as v10.
CLI renders through v7 only (CLI-RENDER-004 for newer model versions) and its
older 4.114.0 parser rejects `runs as` (PLAY0137). Stage 4.51.3's direct planner
also audits only through v7 (STAGE-ESM-016 otherwise). Source/identity contracts
stay intact for gap-fill; source acceptance is not target admission.

The following detailed 4.24.x probes are historical, not current pin claims.

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
composite-key projections, `all`, and compliance attributes (`@pii`, `@sensitive`, which
already fail binding with `PLAY0268`). Any one blocking diagnostic fails the whole plan.
A refusal is not a licence to weaken the model: drop no specification, event generation
or protection to get a render; keep the model, record the capability gap and gap-fill.
The code table, the projection and specification rules and three refusals reproduced while
building the example are in [references/admission.md](references/admission.md); the exhaustive ledger
is `references/renderable-subset.md` in `cratis-screenplay-toolchain`.
Read `cratis-screenplay-toolchain/references/renderable-subset.md` when you need the exhaustive surface ledger beyond the admission summary.

Descriptions and documentation are never rendered, so a rule that exists only in prose
is not enforced in the generated code.

## What it emits

At application scope the plan holds the scaffold plus the modeled artifacts, for the
example 30 files: a `.csproj` and `.slnx`, `Program.cs`, `appsettings.json`,
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

For UI, record what the generated output claims separately from what the model
authored. On Stage 4.24 the generated scaffold is not screen parity evidence.
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
an engine that does, and refuses what it cannot execute (HTTP 501). Callers are built
from unsigned headers, so authorization there is not a security boundary.

`cratis/stage-specrunner` checks modeled specifications and writes a results file. The
default `structural` engine is deprecated and model-level only; `--engine semantic`
executes admitted specs through Arc's in-memory pipeline and reports `Passed`, `Failed`,
`Unsupported` or `Cancelled`. A green result is Stage semantic-engine evidence: not V4 and not a rendered Debug test run. Commands,
the semantic report schema and limits: [references/sandbox-and-specrunner.md](references/sandbox-and-specrunner.md).
Read `references/sandbox-and-specrunner.md` before launching either container or interpreting specification-runner outcomes.

## Verify

- `cratis render` exits 0 and reports `recovered: false`, with `written + unchanged`
  equal to the artifact count; otherwise the render is not a result.
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
