# `cratis screenplay generate` notes

Flags verified with `cratis screenplay generate --help` on the version recorded in
cratis-screenplay-toolchain `references/versions.md`; behaviour from the cratis CLI
(`v3.27.1:Source/Cli/Commands/Screenplay/`), Arc `v22.50.5`
(`Documentation/backend/csharp/generating-a-screenplay.md`,
`Source/DotNET/Screenplay/ScreenplayDiagnosticCodes.cs`), Screenplay.Generation `v0.18.0` and
Screenplay.CritterStack `v0.24.0`. Version-specific capability facts belong in cratis-screenplay-toolchain
`references/versions.md`.

## Command
```
cratis screenplay generate <solution|project|folder> \
  --file .ai-work/screenplay/<model-slug>/legacy/static/static.play [--provider auto|arc|marten|critter-stack] \
  [--framework <TFM>] [--domain <Name>] [--module <Name>] [--feature-root <path>] \
  [--skip-segments <n>] [--modules-from-namespace-roots] -o json
```
- Always pass `--file` into `.ai-work/`. The option help promises a default `Screenplay.play`,
  but the command's own description says it writes to standard output when `--file` is absent
  (`GenerateScreenplayCommand.cs`); the two disagree, so do not rely on either.
- `--file` writes even a partial document when generation reports errors; stdout writes
  nothing on error.
- `--feature-root` is Marten/Critter Stack only; `--modules-from-namespace-roots` is Arc only
  (the other providers warn `CLI0014`).
- Run from the target repository's own checkout. `CLI0017` means workspace source paths that
  cannot be represented as safe, stable identities; fix the location (use the real checkout,
  not a copy or symlink elsewhere) instead of working around it.

## Preconditions
- .NET SDK and **restored** packages (`CLI0005` otherwise). Run `dotnet restore` only when it
  is the repository's normal workflow; it may touch the network and lock files.
- Target resolution walks up to `.slnx` > `.sln` > `.slnf` > `.csproj`. Spec projects are
  excluded by the last segment of the project name (`Specs`, `Specifications`, `Tests`, `Test`,
  `IntegrationTests`, `Specs.AppHost`; `ScreenplayProjectSelection.cs`).
- Multi-targeted projects need `--framework` (`CLI0015/16`). Provider detection: none found
  `CLI0010`, several `CLI0011`; Arc needs a single host (`CLI0009`).
- Arc analyzes a compilation that has errors and reports `SP0024` (source did not compile, how
  many errors, how many artifacts came through anyway); treat such output as partial. Get the
  source to compile first when you can, and record `SP0024` as a loss row when you cannot.

## Coverage (what a provider reads)
| Provider | Reads | Does not read |
|---|---|---|
| Arc | commands, events, concepts, read models, projections, reducers, reactors, constraints, declarative FluentValidation rules, authorization policies, `produces` from constants and input paths, Chronicle integration specs as given/when/then, `.tsx` beside a slice as `screen` + `data via query` | handler bodies, rules written in code, computed messages (`SP0016`), screen bodies, captures, personas, seeds, `@sensitive`. A rule held to `When`/`Unless` is written down as if unconditional and `SP0016` names the condition: read the diagnostic, do not trust the declaration |
| Marten / Critter Stack (preview) | aggregates, snapshots, HTTP and message handlers, document operations, queries, outgoing and delayed messages, saga facts | saga lifecycle, policies, middleware bodies, runtime tenancy, upcasting; unbounded extension code is reported by presence only |
| any non-.NET stack | nothing | use Prologue and targeted reads |

## Diagnostics are the loss list
- Families: `SP####` (Arc), `MARTEN####`, `WOLVERINE####`, `VOG####`, `GEN####`,
  `DOTNETSP####` (placement), `CLI####` (host). Each one is an evidence row or a loss-report
  line.
- Every recovered fact ends in one disposition: Lowered, ProvenanceOnly,
  OmittedWithDiagnostic, Conflicted. Anything not Lowered must be resolved (a targeted read or
  an expert question) or explicitly waived with a reason.
- Evidence strength: Exact, Configured, Conventional, Heuristic. Heuristics never establish
  persistence, stream ownership or authorization.
- "Success" only means no error diagnostic was produced. Read warnings and information too.

## Known lag
The generators are built against older Screenplay packages than the CLI's compiler. Expect
no event generations, no `when append` specifications, and no absence assertions in
generated output, even when the code has them. Reactors are emitted as file-backed
reactions with one named event trigger per observed event (a reactor observing no events
is dropped with a warning), but their bodies and declarative effects are not recovered.
Application triggers (clock, application-defined) are not generated. Record these as
losses, then read the code for them.

## Reading the output cheaply
1. V1 on `.ai-work/screenplay/<model-slug>/legacy/static` (folder mode) with the tool and
   command `cratis-screenplay-toolchain` selects, named with its version; record counts, do
   not fix.
2. Use the Screenplay MCP summary on that folder (`describe-application view=summary`),
   then `search-declarations` for the rows you are resolving.
3. Read the generated `.play` per module, never whole when large. It stands in for the code
   only for what the provider covers (coverage table above).
