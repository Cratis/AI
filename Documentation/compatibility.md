# Compatibility

Maintainer reference for the product releases the AI corpus is checked against. Skills do
not carry these versions: they describe behavior, and an agent reads the exact pins from
the tool or the rendered output it is working with. Update a table when the corpus is synced
to a new release (see [product-sync.md](./product-sync.md)); `Source/Verification/pin-restatements.ts`
parses the CLI and scaffold tables below and fails when a skill restates a current pin.
`Source/Verification/play/fences.ts` (`pinnedVersion`) reads the standalone Screenplay row, which
CI installs and which must match `references/screenplay-contract.version` in the toolchain skill.

## Standalone Screenplay tool

| Item | Value |
| --- | --- |
| Screenplay language, standalone tool and MCP | **4.205.0** |

The published `screenplay-contract.json` beside the toolchain skill's references is byte-identical to
this release's contract, and `screenplay-contract.version` names the same version.

## Cratis CLI

| Item | Value |
| --- | --- |
| Release | cratis CLI `3.74.0` |
| Bundled Stage (renderer and sandbox image) | `4.135.0`, `cratis render` admits ESM v1 to v26 |
| Bundled Screenplay compiler | `4.201.0`, binds through ESM v26 |
| Bundled Screenplay.Generation / CritterStack / Prologue | `0.18.0` / `0.24.0` / `2.0.0` |
| Bundled Cratis.Arc.Screenplay (generator package) | `22.54.0` |
| Bundled Chronicle / Fundamentals | `19.56.0` / `7.22.8` |

## Stage rendered-application scaffold

The pins Stage `4.103.0` writes into a rendered application. Its semantic renderer admits exact ESM v1–v17 and v19 pairs, not v18 or v20. Moving them is a Stage release; a
re-render under a newer Stage is how a rendered application changes them.

| Item | Value |
| --- | --- |
| Target framework | .NET 10 (`net10.0`), `Microsoft.NET.Sdk.Web` |
| Arc packages (`Cratis`, `Cratis.Arc.MongoDB`, `Cratis.Arc.Chronicle.Testing`) | `22.88.0` (includes invocation refusal handling; Stage still refuses mixed reactions because redelivery can duplicate the appended events) |
| Chronicle client | `Cratis.Chronicle`, `.AspNetCore` and `.Testing` `19.64.1`, matched to the `cratis/chronicle:19.64.1-development` image in the compose file |
| Test packages | `Cratis.Specifications` and `.XUnit` 4.1.1, Microsoft.NET.Test.Sdk 18.10.1, NSubstitute 6.2.0, xunit 2.9.3, xunit runner 4.0.0; Debug configuration only |
| Frontend | Vite 8.3.0 and React 19.3.0; `@cratis/arc`, `arc.react`, `arc.vite` 22.58.2; `@cratis/components` 4.26.2; `@cratis/scene.*` 4.22.1; `@cratis/fundamentals` 7.22.8 |

The Scene family pin applies to six scaffold dependencies: `@cratis/scene.blueprint.default`,
`@cratis/scene.components`, `@cratis/scene.engine`, `@cratis/scene.model`,
`@cratis/scene.primereact` and `@cratis/scene.react`. The newest Components release the
corpus has verified does not change the scaffold's Components pin.

## Screens release vector

The public vector the screens guidance was executed against. The skills state the behavior;
this section is the maintainer record of what was run.
`Source/Verification/screenplay-screen-authoring.spec.ts` asserts these values, and compares
the smoke pin in `Source/Verification/screens-smoke/screens-smoke.json` with the **Smoke CLI**
row so the smoke and the recorded vector cannot drift apart.

| Item | Value |
| --- | --- |
| Smoke CLI | CLI 3.53.1 (live browser run with `cratis/stage:4.73.1`; guarded Close and double click run since Stage 4.65) |
| Shell CLI | CLI 3.67.0 (bundles `cratis/stage:4.119.1`, Screenplay 4.180.1): the smoke renders `screens-smoke/shell/application.play` - regions that inherit, extend and override, a toolbar button that starts a State Change slice, a sample data pack - and requires the navigation targets and the toolbar slice in `scene.json` and no sample data in the generated application (the fixture is the CLI's own `Integration/Cli/Shell`, Cratis/cli#374) |
| Executed vector | CLI 3.43.0 (`23e5a24`), default runtime `cratis/stage:4.52.0`, bundled Screenplay 4.127.0, Scene 4.15.0 (Scene 4.17.0 was the earlier verified scaffold tag) |
| Render-then-recover and rejection codes | `CLI-RENDER-007` to `-010`, shipped in CLI 3.41.0 (Cratis/cli#301) |
| MCP edit transcript | 9 requests and 9 responses, column on disk, render `published` with the column in `scene.json` |
| Edited-application browser check | all five browser checks passed against `cratis/stage:4.52.0` |
