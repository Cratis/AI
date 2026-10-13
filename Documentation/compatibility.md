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
| Screenplay language, standalone tool and MCP | **4.153.0** |

The published `screenplay-contract.json` beside the toolchain skill's references is byte-identical to
this release's contract, and `screenplay-contract.version` names the same version.

## Cratis CLI

| Item | Value |
| --- | --- |
| Release | cratis CLI `3.57.0` |
| Bundled Stage (renderer and sandbox image) | `4.89.1`, admits ESM v1 to v15 |
| Bundled Screenplay compiler | `4.147.1`, binds through ESM v15 |
| Bundled Screenplay.Generation / CritterStack / Prologue | `0.18.0` / `0.24.0` / `2.0.0` |
| Bundled Cratis.Arc.Screenplay (generator package) | `22.54.0` |
| Bundled Chronicle / Fundamentals | `19.32.0` / `7.22.8` |

## Stage rendered-application scaffold

The pins Stage `4.89.1` writes into a rendered application. Moving them is a Stage release; a
re-render under a newer Stage is how a rendered application changes them.

| Item | Value |
| --- | --- |
| Target framework | .NET 10 (`net10.0`), `Microsoft.NET.Sdk.Web` |
| Arc packages (`Cratis`, `Cratis.Arc.MongoDB`, `Cratis.Arc.Chronicle.Testing`) | `22.83.0` (includes Arc's events-and-commands reactor result handler; Stage still refuses mixed reactions because redelivery can duplicate the appended events) |
| Chronicle client | `Cratis.Chronicle`, `.AspNetCore` and `.Testing` `19.54.0`, matched to the `cratis/chronicle:19.54.0-development` image in the compose file |
| Test packages | `Cratis.Specifications` and `.XUnit` 4.1.1, Microsoft.NET.Test.Sdk 18.10.1, NSubstitute 6.2.0, xunit 2.9.3, xunit runner 4.0.0; Debug configuration only |
| Frontend | Vite 8.3.0 and React 19.3.0; `@cratis/arc`, `arc.react`, `arc.vite` 22.58.2; `@cratis/components` 4.26.2; `@cratis/scene.*` 4.22.1; `@cratis/fundamentals` 7.22.8 |

The Scene family pin applies to six scaffold dependencies: `@cratis/scene.blueprint.default`,
`@cratis/scene.components`, `@cratis/scene.engine`, `@cratis/scene.model`,
`@cratis/scene.primereact` and `@cratis/scene.react`. The newest Components release the
corpus has verified does not change the scaffold's Components pin.
