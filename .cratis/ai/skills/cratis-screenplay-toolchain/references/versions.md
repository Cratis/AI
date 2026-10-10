# Versions and capabilities by tool (the only version table)

## Contents

- Pin set
- Two compilers, one rule
- Commands and exit codes
- Admission boundaries
- Historical probes
- Revisions and descriptions
- Upgrade checklist

## Pin set

Use the released versions below. A source-checked capability is not a runtime
probe; older probes retain their original labels in the other references.

| Source | Pin | Evidence |
| --- | --- | --- |
| Screenplay language, standalone tool and MCP | **4.127.0** (`e70435a4`) | Released tag `v4.127.0`; installed `screenplay --version`; changed identity/compliance examples compiled |
| cratis CLI | **3.41.0** | Released tag `v3.41.0`; installed `cratis --version` |
| Screenplay bundled by CLI | **4.114.0** | CLI `v3.41.0:Directory.Packages.props` |
| Stage bundled by CLI | **4.51.3** | Same file; the CLI's runtime image follows its Stage package version |
| Cratis.Arc.Screenplay bundled by CLI | **22.54.0** | Same file; this is the generator package, not a blanket rendered-app dependency pin |
| Chronicle / Fundamentals bundled by CLI | **19.32.0 / 7.22.8** | Same file |
| Stage 4.51.3 rendered backend | **Arc 22.50.5 / Chronicle 19.32.0** | Stage `v4.51.3:Source/Rendering.Cratis/Scaffolding/CratisBackendApplicationScaffoldProfile.cs`; client/testing/image match; scaffold disables embedded reverse extraction |

Check the actual executable before relying on this table: `screenplay --version`,
`cratis --version`, MCP `initialize` → `serverInfo.version`. An older executable
on PATH can shadow a newer install; inspect `which -a cratis`.

## Two compilers, one rule

Standalone Screenplay 4.127.0 and the CLI's 4.114.0 bundle are different releases.
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
| Reference specifications | `screenplay test <root> [--filter <address>] [--format text|json]`, or MCP `run-specifications` | 0 all selected passed; 1 failed; 2 could not run/invalid selection; 3 unsupported or unbound. Counts of zero do not prove coverage |
| Rendering | `cratis render` | Separate admission, publication, target build and target tests (V5) |

Source validation does not bind or run attached code. Reference execution is
in-memory and does not run opaque attachments or external services. CLI-derived
specification IDs need not match persisted MCP identities after renames; use MCP
for identity-stable selection.

## Admission boundaries

Screenplay `v4.127.0:Source/DotNET/Screenplay/Semantics/Versions.cs` supports schema
pairs through v10. Generated values/responses and policy negation select v7;
sources/streams and command/specification routes select v8; reaction
`runs as system [role "<Role>"]` selects v10 and reference-executes on 4.125.0.
The checked trusted-actor scenario is in captures-and-reactions
`references/invocation-identity.md`. CLI 3.41.0's 4.114.0 compiler rejects its
source with PLAY0137 (validation probe, exit 5). Stage 4.51.3's direct planner
uses EsmSchemaV7Support and refuses v10 with STAGE-ESM-016; CLI's version gate
separately refuses above v7 with CLI-RENDER-004. A source construct
still requires explicit binder/runner/provider admission: operations, exact
numeric mode and reaction refusals/redelivery remain authorable but unadmitted
(`PLAY0268`). Never delete those contracts to obtain a green bind.

CLI 3.41.0 `RenderedSemanticVersions.Newest` is **v7**:
`Source/Cli/Commands/Render/RenderedSemanticVersions.cs`. Models above it get
`CLI-RENDER-004` before planning/publication. v7 generated values/responses reach
Stage admission; they are not universally refused until CLI#261. That issue is
closed. Each unsupported construct still needs a Stage diagnostic, not a silent
omission or inferred support from package versions.

The renderable-subset and Stage references retain older probes explicitly;
read them as tested snapshots, not as a claim that Stage 4.51.3 shares every
4.24.2 limitation. Query the actual bundled renderer before a V5 claim.

At 4.127.0, `$identity` aliases built-in caller paths; declared identity details
remain metadata and their executable reads report PLAY0268. Bare `pii`/`secret`
still block binding; `personal` aliases `pii`. Legacy markers are accepted with
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
- CLI 3.28.2 file validation ignored imports; this is an old probe, not a current
  reason to invent missing declarations. Validate the complete root.
- Older standalone empty-folder probes exited 0. Current validation still needs
  a nonzero file count, and specification execution needs an expected selection.

## Revisions and descriptions

`modelRevision` exists only when binding succeeds; it is canonical semantic
identity, not source identity. Source positions and report-only metadata can
change source/workspace revisions without changing it. Persisted catalogs
preserve assigned identities; do not reconstruct them from names.

A render manifest's `semanticRevision` is a different provenance value, made
with the render name and bundled compiler. Do not compare it directly to MCP
`modelRevision`. Compare successive renders with the same identity and inputs.

## Upgrade checklist

1. Read installed versions and released dependency pins.
2. Check source, binder, reference runner and renderer admission separately.
3. Compile each changed example; execute specification examples with the
   reference route. Preserve explicit expected-diagnostic checks.
4. Re-probe affected capabilities before replacing a historical version label.
