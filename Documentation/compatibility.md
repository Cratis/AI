# Compatibility

The product releases the corpus skills were checked against. Skills describe behavior and do not repeat these versions; an application uses the versions it has installed. A skill that needs a later release says so where it matters.

## Product releases

| Product | Release | Packages |
| --- | --- | --- |
| Arc | 24.9.0 | `Cratis`, `Cratis.Arc.*`, `@cratis/arc`, `@cratis/arc.react` |
| Chronicle | 19.184.3 | `Cratis.Chronicle`, `.AspNetCore`, `.Testing`, the `cratis/chronicle` image |
| Components | 4.63.1 | `@cratis/components` |
| Fundamentals | 7.34.5 | `Cratis.Fundamentals`, `@cratis/fundamentals` |
| Specifications | 5.3.0 | `Cratis.Specifications.XUnit.v3` (with `xunit.v3` 4.0.2) |
| Screenplay | 7.0.0 | The standalone Screenplay tool and MCP server the modeling and Screenplay skills author against |
| Cratis CLI | 3.154.2 | `Cratis.Cli`: scaffolding, diagnostics and `cratis render`. It bundles Stage renderer 6.4.1 and Screenplay 6.37.0, which admit a model separately from the standalone tool. The profile catalog in this corpus needs a later CLI release |
| Templates | 1.9.2 | `Cratis.Templates`: the C# full-stack application template. `Cratis.Templates.Extensions`: the Stage extension scaffold |
| Stage extensions | 5.30.0 | `Cratis.Stage.Extensions` with a Stage 5.30.0 host, C# backend on `net10.0`. The extension template requires Stage 5.x, not the 6.4.1 renderer the CLI bundles |
| release-action | 1.5.2 | `cratis/release-action` batching, as described by `cratis-platform-prepare-release-pr` |

The compiled examples in `Evaluations/corpus-v2/examples` pin the Arc, Chronicle, Fundamentals and Specifications rows and target .NET 10 or .NET 11. The CLI and the standalone Screenplay tool run on .NET SDK 11.0.100. Moving a row means rebuilding those examples and rereading the skills that teach the changed surface.

## Native SDKs

`cratis-arc-select-backend-sdk` and `cratis-chronicle-select-client` name these releases. Each SDK versions independently of the .NET packages and of `@cratis/arc`, the generated browser client. A row records what was checked; it does not claim feature parity with .NET or that the release is the newest.

| SDK | Release | Package |
| --- | --- | --- |
| Arc for TypeScript | 1.0.0 | npm `@cratis/arc.core` |
| Arc for Java and Kotlin | 7.11.1 | Maven Central `io.cratis:arc-spring-boot-starter` |
| Arc for Elixir | 1.4.10 | Hex `cratis_arc` |
| Arc for Go | 0.1.4 | `github.com/cratis/arc.go` |
| Chronicle contracts for Java and Kotlin | 19.184.3 | Maven Central `io.cratis:chronicle-contracts` |
| Chronicle contracts for Elixir | 19.184.3 | Hex `cratis_chronicle_contracts` |
| Chronicle contracts for TypeScript | 19.184.3 | npm `@cratis/chronicle.contracts` |
| Chronicle contracts for Python | 19.184.3 | `cratis-chronicle-contracts`, built from the Chronicle source at that tag; the release publishes no wheel |
| Chronicle for Go | 0.17.0 | `github.com/cratis/chronicle.go`, used only as an offline generated-message example. Its kernel tests and decision support target Chronicle 19.153.0, so it is not checked against 19.184.3 |

## Standalone Screenplay tool

| Item | Value |
| --- | --- |
| Screenplay language, standalone tool and MCP | **6.43.0** |

CI installs this release for the standalone Screenplay check, which is older than the 7.0.0 the skills were checked against; `Source/Verification/play/fences.ts` and `Source/ScreenplaySession/src/version.ts` read the row.
