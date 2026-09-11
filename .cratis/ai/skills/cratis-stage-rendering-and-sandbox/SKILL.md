---
name: cratis-stage-rendering-and-sandbox
description: Understand what Cratis Stage actually does with a Screenplay `.play` model today — the deterministic artifact render plan and the narrow model shape it admits, the disposable `cratis/stage` sandbox container, and the `cratis/stage-specrunner` model-level specification job. Use when deciding whether Stage can render a model, when interpreting a blocked render plan, or when running the sandbox. Do not use for authoring the `.play` model itself.
license: MIT
---

# What Stage renders, and what it refuses

Stage turns a Screenplay `.play` model into Cratis Arc + Chronicle application
source. It ships three things: a **renderer** exposed as a .NET library, a
**disposable runtime sandbox** container, and a **specification runner**
container.

⚠️ **Stage is experimental, and its admitted model shape is very small.** The
renderer accepts one command per state-change slice, one produced event,
`not empty` validation only, one read model with one projection, and at most one
by-identifier snapshot query. Anything richer produces **no artifacts at all**,
not thinner ones. Read the admission rules below before promising a model can be
rendered.

## Verified product sources

| Artifact | Version | What it is |
| --- | --- | --- |
| `Cratis.Stage.Contracts` | `3.11.0` | `ArtifactRenderPlan`, `EventModelLoader`, specification-result contracts |
| `Cratis.Stage.Rendering.Cratis` | `3.11.0` | The one rendering target and the `CratisRendering` facade |
| `Cratis.Stage` | `3.11.0` | The partial direct runtime engine |
| `cratis/stage` | `3.11.0`, `latest` | Disposable HTTP host plus an in-memory Chronicle kernel |
| `cratis/stage-specrunner` | `3.11.0`, `latest` | Run-to-completion specification job |

Behavior below is read from the repository at revision `4f3fc6a`. `Cratis.Stage.Host`
and `Cratis.Stage.SpecRunner` are **not** packable — they exist only as the two
container images.

## Input

The authoritative input is Screenplay source: a folder of `.play` files,
compiled recursively over `**/*.play` and merged into one model. There is no
other supported entry format — an `event-model.json` file is **not** the current
startup or rendering contract, and the loader cannot read one.

## The renderer

There is **no CLI, no dotnet tool, and no container for rendering.** The entry
point is a static facade in `Cratis.Stage.Rendering.Cratis`:

```csharp
var options = new CratisRenderingOptions("Projects", "Projects");
var scope = new ArtifactRenderScope(ArtifactRenderScopeKind.Application, model.Application.Id);
var plan = CratisRendering.Plan(model, executionPlan, scope, options);
```

⚠️ Two things make this harder than it looks:

1. It takes a Screenplay `ExecutableSemanticModel` and a `SemanticExecutionPlan`,
   **not** a folder path. Stage ships no helper that turns `.play` files into
   those — `EventModelLoader` produces the other, syntax-shaped model that the
   renderer does not accept. Producing the semantic model is the caller's job,
   using `Cratis.Screenplay`'s `SemanticModelCompiler` and
   `SemanticExecutionPlan.Compile`.
2. The intended callers are the Cratis CLI and Studio. Rendering from a terminal
   today means writing C# against this facade.

Callers pass only a project name and a root namespace. The facade owns every
target, renderer, profile, package and runtime version itself; do not
reconstruct or modify the profile — the planner rejects changed identities,
versions, input rosters, bytes and hashes.

`Plan` performs no file-system, process, network, environment, clock or random
access. It returns an `ArtifactRenderPlan` holding normalized relative paths,
exact bytes and a SHA-256 per artifact, plus typed diagnostics. **Publish only
when `plan.Success` is true; a failed plan carries diagnostics and no candidate
artifacts.**

### What it admits

Every rule below is enforced, and each failure is a blocking `STAGE-ESM-00x`
diagnostic that stops the whole plan.

For a `StateChange` slice:

- exactly one `command` (`STAGE-ESM-004`);
- exactly one `produces` on it, no optional event properties, and validation
  limited to `not empty` with no operand (`STAGE-ESM-005`);
- an unconditional `produces` whose destination is a command identifier property
  and whose mappings match the event's properties one for one
  (`STAGE-ESM-006`).

For a `StateView` slice:

- exactly one `readmodel`, exactly one `projection`, at most one `query`
  (`STAGE-ESM-007`);
- one resolvable read-model transition on that projection (`STAGE-ESM-008`);
- an affected-instance cardinality of one, keyed by an event property, carrying
  the event-source identity (`STAGE-ESM-009`);
- if a query is present: an optional (`ZeroOrOne`) snapshot lookup by the read
  model's single identifier (`STAGE-ESM-010`).

Screenplay's own executable semantic model already rejects `Automation` and
`Translate` slices before Stage sees them, so those never reach the renderer at
all.

### What it emits

At application scope, exactly eight deterministic backend scaffold files:
`Directory.Build.props`, `Directory.Build.targets`, `Directory.Packages.props`,
the `.csproj`, the `.slnx`, `Program.cs`, `appsettings.json` and
`docker-compose.yml`. The generated `Program.cs` is the whole application host:

```csharp
using Cratis.Arc.MongoDB;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHealthChecks();
builder.AddCratis(
    configureArcBuilder: arc => arc.WithMongoDB(),
    configureChronicleBuilder: chronicle => chronicle.WithCamelCaseNamingPolicy());

var app = builder.Build();
app.UseCratis();
app.MapHealthChecks("/healthz");

await app.RunAsync();
```

Per model, it emits concept types (`ConceptAs<T>` and `EventSourceId<T>`), a file
per state-change slice holding the `[Command]` record with its `Handle()`, the
`[EventType]` record it produces and a `CommandValidator<T>`, a file per
state-view slice holding the `[FromEvent<T>] [ReadModel]` record and its static
query method, and one xunit specification file per modeled `specification`,
wrapped in `#if DEBUG`.

The profile pins .NET 10, Cratis/Arc `22.3.0`, and the Chronicle image
`16.35.3-development` in the generated compose file. It emits **no frontend** —
screens, layouts and forms are outside the current backend milestone — and no
`.gitignore`, repository marker, floating version or random identifier.

The generated compose binds local ports `27017` and `35000`. Start it with
`docker compose up --detach`, run the generated project, and probe `/healthz`.

⚠️ There is **no committed generated output anywhere in the repository** — no
golden files, no approval snapshots, no sample `.play` fixtures. Every claim
about output is proven instead by a specification that plans the frozen
`RegisterProject` corpus, writes the bytes to a temporary directory, runs
`dotnet build`, `dotnet test` and `dotnet build -c Release` over them with zero
warnings, and — when Docker is available — boots the result against a real
Chronicle container and polls `/healthz`. That is a genuine end-to-end proof, for
exactly one model.

### "Reviewable" means deterministic, not reviewed

The plan is destination-independent, ordered, hashed, LF-normalized and UTF-8
without a BOM, and re-planning the same input produces identical paths, hashes
and bytes. That is what lets a caller diff a plan.

⚠️ **No review, diff, approval or staged-commit mechanism is implemented.** Safe
staged publication and stale-file removal are explicitly deferred to work outside
this repository. Do not describe Stage as reviewing or approving anything.

The older syntax-based `IRenderer` and the optional
`Cratis.Stage.Rendering.Cratis.Scaffolding` package cover more of the language
but write straight to disk, and the repository is blunt about them: direct
rendering has no managed staging or safe stale-file removal, and a failure can
leave its target **unsafe and incomplete**. Treat them as legacy compatibility
only.

## The sandbox

```bash
docker run --rm \
    -p 9090:9090 \
    -p 35000:35000 \
    -v "$PWD":/eventmodel \
    cratis/stage:latest
```

The image pairs the Stage host with an in-memory Chronicle kernel and takes the
model folder as its first argument. The Stage API is on `9090`, the Chronicle
Workbench on `35000`. Deployment configuration is read from `cratis-stage.json`,
overridable through the `STAGE_CONFIG` environment variable — not from
`appsettings.json`.

⚠️ It is a **partial** runtime, not a generated application. Commands evaluate
their modeled `produces` mappings, append the facts to Chronicle and echo the
payload; **modeled validation and authorization are not enforced on this path.**
Modeled queries **deny by default and return no data** — the query performer's
`IsAuthorized` returns false and `Perform` returns null or an empty array — until
an executable query authorization contract exists in Screenplay. A sandbox query
returning nothing is the designed behavior, not a bug in the model.

## Modeled specifications

```bash
docker run --rm \
    -v /path/to/screenplays:/model \
    -v /path/to/results:/output \
    cratis/stage-specrunner:latest
```

A run-to-completion job: it compiles the `.play` files, checks the modeled
specifications against the model, writes `results.json` and exits. It accepts
`--model <folder>` and `--output <file>`, plus optional `--slice <guid>` and
`--spec <guid>` filters, and defaults to `/model` and `/output/results.json`.

⚠️ Verification is **model-level**. It checks that the modeled facts and
expectations are consistent; it does not execute each slice against a live
runtime. A green `results.json` is not a passing integration test.

## Verify

- The model reaches the renderer as an `ExecutableSemanticModel` plus a
  `SemanticExecutionPlan`, not as a folder path.
- `plan.Success` is true before any byte is written; a blocked plan's
  `STAGE-ESM-00x` diagnostics name the construct to simplify.
- Every state-change slice has one command, one `produces`, and only
  `not empty` validation; every state-view slice has one read model, one
  projection, and at most a by-id snapshot query.
- Re-planning the same input yields identical hashes.
- Expectations about the sandbox account for unenforced validation and
  authorization and for queries that return nothing.
- No claim is made that Stage reviewed, staged or approved anything.

## Route near misses

- Writing or verifying the `.play` model itself:
  `cratis-screenplay-model-authoring`.
- Understanding the generated Arc command, validator or read model as C#:
  `cratis-arc-command` and the Chronicle read-model guidance.
- Inspecting the Chronicle store the sandbox writes into: the Chronicle CLI or
  Workbench guidance.
