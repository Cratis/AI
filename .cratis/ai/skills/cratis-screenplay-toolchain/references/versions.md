# Versions and capabilities by tool (the only version table)

## Contents

- Pin set
- Two compilers, one rule
- Commands and exit codes
- Model notes gate
- Admission boundaries
- Historical probes
- Revisions and descriptions
- Upgrade checklist

## Pin set

Use the released versions below. A source-checked capability is not a runtime
probe; older probes retain their original labels in the other references.

| Source | Pin | Evidence |
| --- | --- | --- |
| Screenplay language, standalone tool and MCP | **4.145.0** (`bf58b489`) | Released tag `v4.145.0`, published NuGet tool and byte-identical Golden contract; read-only proposal specification execution with `proposalId`; model notes/open-question gate and ESM v14 equality filters retained |
| cratis CLI | **3.53.1** | Released tag `v3.53.1`; source-checked, not a new render/browser probe |
| Screenplay bundled by CLI | **4.137.0** | CLI `v3.53.1:Directory.Packages.props`; enum-number authoring, not v12 binding |
| Stage bundled by CLI | **4.73.1** | Same file; Stage's own `Directory.Packages.props` also pins Screenplay 4.137.0 |
| Latest standalone Stage released when this was checked | **4.76.0** (Screenplay 4.139.0) | Released tag `v4.76.0`; no cli release bundles Stage 4.74.0 to 4.76.0, so a cli user observes none of it. It admits ESM v1 to v12 (v11 from 4.75.0, v12 from 4.76.0), renders UUID-concept generated values and responses (4.74.0) and explicit enum numbers (4.76.0). Its scaffold pins match 4.73.1 (Arc 22.68.0, Chronicle 19.45.0, frontend pins); `Directory.Packages.props` takes Scene 4.21.0 |
| Screenplay.Generation / CritterStack / Prologue bundled by CLI | **0.18.0 / 0.24.0 / 2.0.0** | CLI `v3.53.1:Directory.Packages.props`. Latest released: Generation 0.18.1, CritterStack 0.26.0, Prologue 2.0.0 (no release after 2.0.0); the newer Generation and CritterStack releases are not in a cli |
| Cratis.Arc.Screenplay bundled by CLI | **22.54.0** | Same file; this is the generator package, not a blanket rendered-app dependency pin |
| Chronicle / Fundamentals bundled by CLI | **19.32.0 / 7.22.8** | Same file |
| Latest Arc / Chronicle / Fundamentals released when this was checked | **22.76.0 / 19.51.0 / 7.23.0** | Released tags; newer than the CLI bundle and than Stage's scaffold. Arc 22.72.0 and later run a reactor returning events and commands (absent through 22.71.0); the Stage 4.73.1 scaffold pins Arc 22.68.0, whose command handler accepts a collection only when every element is a command, so a rendered app needs a proven dependency override to 22.72.0 or later |
| Stage 4.73.1 rendered backend and frontend | **Arc 22.68.0 / Chronicle 19.45.0**; `@cratis/components` 4.26.2, `@cratis/scene.*` 4.21.0, `@cratis/arc` 22.58.2, Fundamentals 7.22.8 | Stage `v4.73.1:Source/Rendering.Cratis/Scaffolding/CratisBackendApplicationScaffoldProfile.cs` and `CratisFrontendPackageSet.cs` (`Current`); not the latest releases and not bumped by hand |
| Historical Stage 4.51.3 rendered backend | **Arc 22.50.5 / Chronicle 19.32.0** | Stage `v4.51.3:Source/Rendering.Cratis/Scaffolding/CratisBackendApplicationScaffoldProfile.cs`; client/testing/image match; scaffold disables embedded reverse extraction |

Scene's family id denotes the six scaffold packages listed in
`cratis-stage-rendering-and-sandbox/references/rendered-application.md`, not a
package named `@cratis/scene`. The Components skills verify the latest 4.26.4
surface; that does not upgrade Stage's managed scaffold pin.

The published `screenplay-contract.json` beside this reference is the machine-readable authority for PLAY codes, MCP tools and parameters, and standalone CLI commands/options. Its unchanged release bytes are pinned by `screenplay-contract.version` to the standalone version above. Before adding a claim, search this large JSON file by exact `code` in `diagnostics`, or by exact `name` in `mcpTools`/`cliCommands`, and inspect that object's retirement flag, parameters or options; do not load the full file into context. For example, search for `"code": "PLAY0029"` or `"name": "read-workspace"`; `screenplay-contract-exceptions.json` preserves explicitly reasoned historical statements, not current-release exceptions. Coverage gaps are mention inventories, not proof that a skill teaches a feature.

Check the actual executable before relying on this table: `screenplay --version`,
`cratis --version`, MCP `initialize` → `serverInfo.version`. An older executable
on PATH can shadow a newer install; inspect `which -a cratis`.

**Minimum for no-model MCP startup: Cratis CLI 3.46.1.** At `v3.46.1`,
`cratis screenplay mcp --project-root <project>` resolves a root without creating
it; startup, discovery and proposals leave no model folder, and the first
`apply` write creates it. `cratis ai install` creates no model folder unless a
root is configured. Older CLIs create the resolved root on server startup (`Screenplay/` when no `.play` files, `Source/` or `src/` exist). Released
source evidence: CLI
`Source/Cli.Specs/for_ScreenplayMcpInvocation/when_serving_a_project_without_a_model/and_the_client_writes_a_document.cs`
and `Source/Cli.Specs/for_AiMcpRegistration/when_installing/with_a_composed_profile.cs`
at tag `v3.46.1` (CLI#322 / CLI#311). This minimum does not re-label the compiler
or renderer probes below as results from the newer bundle.

## Two compilers, one rule

Standalone Screenplay 4.145.0 and CLI 3.53.1's 4.137.0 bundle are different releases.
Prefer standalone for the current language checks; CLI owns generation, Prologue
and rendering. Name the tool/version with every verdict. No verdict transfers
between differing compilers without checking the same inputs there.

A folder compiles as one application. A standalone file includes its imports,
not unimported siblings. Keep the application root as input for scoped checks.
Do not treat a clean fragment or scoped result as whole-application success.

MCP server launch: `screenplay mcp <model-root>` or
`cratis screenplay mcp <model-root>`. Discover `tools/list`, views and schemas
rather than counting tools. Connection, worktree switching and root-state
conflicts: `cratis-screenplay-model-authoring`.

## Commands and exit codes

| Layer | Route | Verdict |
| --- | --- | --- |
| Source validation | `screenplay <root> --warnaserror --no-color` | 0 clean; 1 reported defects; 2 could not run/invalid arguments or input. `--scope` limits the reported set, not compilation |
| Completeness | Add `--check <name>[,<name>]` (repeatable) or `--check all` | Opt-in warnings; whole-source errors skip checks, not pass them |
| CLI source validation | `cratis screenplay validate <root> --warnings-as-errors -o json-compact` | Read producer exit and JSON errors/warnings/file count. Passing source-only probe on CLI 3.41.0: dependencies example, exit 0 |
| Binding | MCP workspace readiness and `executable-diagnostics` | V2 reads diagnostics; V3 requires binding with no blocking diagnostics |
| Reference specifications | `screenplay test <root> [--filter <address>] [--format text|json]`, or MCP `run-specifications` (`specification`, `scope`, `offset`, `limit`, `expectedSourceRevision`; `proposalId` from 4.145.0) | 0 all selected passed; 1 failed; 2 invalid arguments/input/selection or IO; 3 unsupported or unbound. `test` rejects `--no-color`; counts of zero do not prove coverage |
| Rendering | `cratis render` | Separate admission, publication, target build and target tests (V5) |

Source validation does not bind or run attached code. Reference execution is
in-memory and does not run opaque attachments or external services. CLI-derived
specification IDs need not match persisted MCP identities after renames; use MCP
for identity-stable selection. On Screenplay **4.145.0 and later**, run a retained
proposal read-only with `proposalId` after review and before apply. Without that
argument it runs the current workspace. An impossible `then` (PLAY0285)
unbinds the entire model and prevents every specification running.

## Model notes gate

**Standalone Screenplay 4.144.0** ships `--open-questions report|fail`.
**Cratis CLI 3.53.1 does not have this gate** and bundles Screenplay 4.137.0,
which also predates the notes MCP tools. Do not add this option to
`cratis screenplay validate` or assume its bundled MCP supports model notes.
Sources: Screenplay `v4.144.0:Source/DotNET/Tool/ModelOpenQuestions.cs:18-69,87-131`;
CLI `v3.53.1:Source/Cli/Commands/Screenplay/ValidateScreenplaySettings.cs:11-85`
and `Directory.Packages.props:8,35-37`. No newer Cratis CLI gate was verified.

```shell
screenplay <model-folder> --open-questions report --no-color
screenplay <model-folder> --scope Library.Loans.CheckIn --open-questions fail --no-color
```

`report` emits info `model-note.open-question` findings without failing for
questions. `fail` exits **1** when the selected set has an open question;
unreadable notes exit **2** when the flag is given. Compilation still runs with
its own verdict; question findings are MCP/CLI only, **no PLAY code**. With no
flag the sidecar is ignored, and `--warnaserror` does not gate questions. Tasks
and ordinary notes do not fail this gate.

Scope includes descendants and ancestor notes (application notes too). An
unscoped report includes orphaned open questions. Absent identity state reports
all open questions unscoped as orphaned with `identity-state-absent`, rather than
hiding them behind a scope. Notes never change ESM or V1–V5 verdicts. Read
model-authoring [model notes](../../cratis-screenplay-model-authoring/references/model-notes.md)
when recording, resolving, paging or reviewing orphan impact.

## Admission boundaries

Screenplay `v4.144.0:Source/DotNET/Screenplay/Semantics/Versions.cs` supports
schema pairs through v14. Admission selects by use:

- v7: generated values/responses and policy negation.
- v8: sources/streams and command/specification routes.
- **Released v9 (4.117.0):** public events/origins, Translate direction,
  event-target projections/reducers and events-source captures. Publication folds
  reference-execute; captures and reached opaque reducers return typed Unsupported.
  Public/foreign imports without local shapes remain PLAY0268. See
  automations-and-translations `references/public-events-and-direction.md`.
- **Released, frozen v10:** reaction `runs as system [role "<Role>"]` first
  shipped in 4.125.0; production route overrides and observer filters shipped in
  4.129.0. Marked released by #647 in 4.133.2. Decision 0066 records the shipped
  extension as a retroactive exception: consumers admit all three together.
  Checked actor scenario: captures-and-reactions `references/invocation-identity.md`;
  route/filter contract: [production routes and filters](production-routes-and-filters.md).
- **Published v11 in 4.135.0:** qualifying retained non-route Double-mode literals
  select v11 and execute with corrected decimal lowering (decision 0064). This
  includes whole numbers such as `9007199254740991` and qualifying fractions;
  unused/overridden examples and validation-only values do not select it.
  Already-lossless routes/route-feeding inputs do not select v11. This does not
  admit `numbers exact` source mode or arbitrary precision. At this tag,
  interoperability documentation still says "claimed, unreleased"; this corpus
  follows Versions.cs and decision 0066's publication boundary.
- **Published, frozen v12 in 4.139.0:** non-positional explicit enum numbers
  select v12, carrying optional canonical last `numbers` parallel to `values`.
  Positional pins retain earlier executable bytes/version/revision; unnumbered
  enums retain positional meaning. Names remain fixture/condition/specification
  values. Strict reading rejects arrays in older versions, without enum values,
  with mismatched length, duplicates, non-int32 entries or positional numbers
  (non-canonical). Consumers must admit v12 explicitly. Authoring shipped in
  4.137.0 (decision 0065); syntax/example: command-surface `references/enum-numbers.md`.
- **Published v13 in 4.141.0:** concept `pii`/`secret`, personal qualifiers and
  secret scopes bind as optional concept `compliance`. Unmarked models retain
  their exact bytes/version/revision. Reference execution outcomes stay unchanged;
  it proves no storage encryption or erasure. Enum/identity compliance and an
  event combining personal or explicitly subject-scoped secret values with an
  explicit `subject` mark refuse PLAY0268. See command-surface
  `references/compliance.md` and Screenplay decision 0068. Stage 4.76.0 admits
  only through v12; no current cli bundles this compiler or admits v13.
- **Published v14 in 4.143.0:** caller-supplied equality filters on collection
  queries with same-named, type-matched scalar read-model properties; no `from`.
  Optional filters may be omitted, supplied null is refused, and `by` plus supplied
  filters combine with AND. Models without filters preserve bytes/revision.
  Screenplay `v4.144.0:decisions/0069-admit-equality-query-filters-as-esm-v14.md:43-88`;
  this newer standalone admission does not upgrade CLI or Stage.

Decision 0066 freezes a version when any exposing NuGet/npm package is published,
including prereleases. Later byte-changing features take the next version at
admission; a byte-preserving extension under 0004 is the exception. Published
numbers never change or get reused. Enum member numbers are admitted as v12;
this does not admit flags or numeric values in name-based specifications.
Concept generation strategies and freshness (decision 0054, #616) are accepted but not implemented. Operations,
exact source numeric mode and reaction refusals/redelivery remain PLAY0268.
Composite read-model keys/query blocks are also still PLAY0268 (#599), not
admitted by the 4.129.0 authoring delivery; a single explicit key preserves bytes.
Never delete these contracts to obtain a green bind.

CLI 3.53.1 `RenderedSemanticVersions.Newest` is **v10**:
`Source/Cli/Commands/Render/RenderedSemanticVersions.cs`. Stage 4.73.1 uses
EsmSchemaV10Support in `Source/Rendering.Cratis/Semantics/SemanticVersionFeatures.cs`
and construct checks in `SemanticVersionFeatureAdmission.cs`. Both bundle
Screenplay 4.137.0: non-positional enum numbers pass source validation but
fail executable binding with PLAY0268, before renderer version admission.
Standalone >= 4.139.0 binds them as v12; that verdict does not transfer to
`cratis render`. The bundled compiler and Stage do not support reading v12 ESM.
A compiler upgrade alone would not lift the CLI/Stage v10 admission ceiling.
Bound v11 models get CLI-RENDER-004 before planning (STAGE-ESM-016 at the
Stage version gate); this is not the diagnostic path for v12 source on these pins.
Through v10 is not blanket
render support: public publication STAGE-ESM-032, foreign events/event captures
033, reaction identity 034, reaction filters 035 and production overrides 036
remain refused; reducer filters render. ESM v8 routes reach their own checks.
Previous CLI 3.46.1/Stage 4.52.0 admitted only through v7 (CLI-RENDER-004 and
STAGE-ESM-016 respectively). Historical CLI 3.41.0/Screenplay 4.114.0 rejected
`runs as` at parsing (PLAY0137, exit 5), not a current parser claim. Each unsupported
construct needs a diagnostic, not silent omission or guessed package support.

The renderable-subset and Stage references retain older probes explicitly;
read them as tested snapshots, not as a claim that Stage 4.52.0 shares every
4.24.2 limitation. Query the actual bundled renderer before a V5 claim.

Stage case tables require 4.59.0; ESM v8 whole numbers as `long` and the
pre-v8 out-of-`int` refusal STAGE-ESM-031 require 4.61.0. Historical CLI 3.50.0
defaulted to Stage 4.67.0; current CLI 3.53.1 defaults to 4.73.1, so both rules apply. Previous CLI 3.46.1 bundled Screenplay
4.130.0 and Stage 4.52.0; neither rule applied there. `cratis run --tag 4.63.2`
selects a newer sandbox image only (`RunSettings.cs`), not a renderer package.
`cratis render` has a statically bundled target (`RenderSettings.cs`,
`CratisRenderTarget.cs`); a newer renderer needs a CLI release that pins it.
The Stage skill teaches the version-gated examples.

At 4.127.0, `$identity` aliases built-in caller paths; declared identity details
remain metadata and their executable reads report PLAY0268. Bare `pii`/`secret`
bind as v13 on standalone 4.142.0, but still block binding on CLI 3.53.1's
4.137.0 bundle; `personal` aliases `pii`. Legacy markers are accepted with
PLAY0565 information, duplicates warn PLAY0653. Event `subject` and processing
purposes are report-only metadata (PLAY0270); purpose checks/reports do not prove
lawfulness or enforce retention. See command-surface context/compliance references.

Authoring features source-checked in standalone 4.127.0: `propose-source`,
`find-specification-obligations`, `find-modeling-smells`, specification descriptions,
container/command/read-model/reaction documentation, routed redelivery locators,
guarded item interactions, persona callers and named case tables. Discover schemas
in the older CLI bundle rather than assuming parity. Cases/persona callers expand
to ordinary ESM; metadata changes no executable bytes. Redelivery remains
unadmitted even when its route is valid. Details: model-authoring MCP references,
specifications, UI composition and `diagnostics.md`.

## Historical probes

- Screenplay 4.68.0 admitted v7; CLI 3.28.2/3.28.3 bundled 4.66.0 (v6 at most),
  Stage 4.24.1/4.24.2. Those old negative v7 probes do not describe CLI 3.41.0.
- CLI before 3.28.2 bundled Screenplay 4.60.1: false cascade PLAY0285, v6 refusal
  and dynamic-root initialization bug. The roots bug was fixed in 4.63.2.
- CLI 3.28.2 file validation ignored imports (cli#244, closed by PR #258): later CLI releases compile
  the file as an application root together with its imports. Folder mode stays the recommended check;
  validate the complete root.
- Older standalone empty-folder probes exited 0. Current validation still needs
  a nonzero file count, and specification execution needs an expected selection.

## Revisions and descriptions

`modelRevision` exists only when binding succeeds; it is canonical semantic
identity, not source identity. Source positions and report-only metadata can
change source/workspace revisions without changing it. Persisted catalogs
preserve assigned identities; do not reconstruct them from names.

A render manifest's `semanticRevision` is a different provenance value, made
with the render name and bundled compiler. Do not compare it directly to MCP
`modelRevision`. Compare successive renders with the same identity and inputs, or use
`cratis render ... --check` (CLI 3.44.0 or later). Descriptions and event documentation render as XML
doc comments, so editing them changes managed-file hashes (a `--check` exit 6) but not the executable
model revision.

## Upgrade checklist

1. Read installed versions and released dependency pins.
2. Check source, binder, reference runner and renderer admission separately.
3. Compile each changed example; execute specification examples with the
   reference route. Preserve explicit expected-diagnostic checks.
4. Re-probe affected capabilities before replacing a historical version label.
