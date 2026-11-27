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
| Cratis CLI | 3.154.2 | `Cratis.Cli`: the scaffold and diagnostic commands the platform skills use. The profile catalog in this corpus needs a later CLI release |
| Templates | 1.9.2 | `Cratis.Templates`: the C# full-stack application template |
| release-action | 1.5.2 | `cratis/release-action` batching, as described by `cratis-platform-prepare-release-pr` |

The compiled examples in `Evaluations/corpus-v2/examples` pin the Arc, Chronicle, Fundamentals and Specifications rows and target .NET 10 or .NET 11. Moving a row means rebuilding those examples and rereading the skills that teach the changed surface.

## Standalone Screenplay tool

| Item | Value |
| --- | --- |
| Screenplay language, standalone tool and MCP | **6.43.0** |

CI installs this release for the standalone Screenplay check; `Source/Verification/play/fences.ts` and `Source/ScreenplaySession/src/version.ts` read the row.
