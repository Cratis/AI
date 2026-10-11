# The rendered application: scaffold, managed files and `Customizations/`

## Contents

- Scaffold pins
- What is managed
- `Customizations/` (unmanaged)
- Re-render checklist

Read at Stage `v4.24.0`, with the scaffold pins re-read at `v4.73.1` (`Scaffolding/CratisBackendApplicationScaffold*.cs`,
`CratisFrontendApplicationScaffold.cs`, `README.md`,
`Documentation/guides/customize-rendered-application.md`) and checked against a real
render (see [render-example.md](render-example.md)).

## Scaffold pins

The pin rows below are source-checked at Stage `v4.73.1` (the Stage in CLI 3.53.1),
`Source/Rendering.Cratis/Scaffolding/CratisBackendApplicationScaffoldProfile.cs` (`Current`),
`CratisBackendApplicationScaffold.cs` and `CratisFrontendPackageSet.cs` (`Current`; read the
`Current` argument list, because the class summary still quotes older Scene and Components
versions). The scaffold pins an exact release per package and lags the latest releases by design
(Arc 22.72.0 and Chronicle 19.50.0 were current when this was checked); moving them is a Stage
change, so a re-render under a newer Stage is how they change. Earlier runtime/customization
probes above keep their original labels.

| Item | Value |
| --- | --- |
| Target framework | .NET 10 (`net10.0`), `Microsoft.NET.Sdk.Web` |
| Arc packages (`Cratis`, `Cratis.Arc.MongoDB`, `Cratis.Arc.Chronicle.Testing`) | `22.68.0` (below Arc 22.70, so reverse-generator compliance diagnostics and the like are not in the scaffold; Arc 22.64.1 and later run reactors returning events and commands) |
| Chronicle client | `Cratis.Chronicle`, `.AspNetCore` and `.Testing` `19.45.0`, matched to the `cratis/chronicle:19.45.0-development` image in the compose file |
| Embedded reverse extraction | `CratisEmbeddedScreenplayEnabled=false`: the source `.play` is authoritative |
| Test packages | `Cratis.Specifications` and `.XUnit` 4.1.1, Microsoft.NET.Test.Sdk 18.10.1, NSubstitute 6.2.0, xunit 2.9.3, xunit runner 4.0.0; **Debug configuration only** (`IsTestProject` when Debug) |
| Frontend | Vite 8.3.0 and React 19.3.0; `@cratis/arc`, `arc.react`, `arc.vite` 22.58.2; `@cratis/components` 4.26.2; `@cratis/scene` 4.21.0; `@cratis/fundamentals` 7.22.8 |
| Package management | central package management **off**; `Directory.Packages.props` is managed, do not edit it |

Consequences: `[ProtectedDecision]` (`Cratis.Arc.Chronicle.ReadModels`) and
`DecisionRead<T>` / `IDecisionReads` (`Cratis.Chronicle.ReadModels`) are available
in this scaffold's package set, as is `[ExecuteCommandsAsSystem]`. This is API
availability, not Stage emission or runtime protection: gap-fill must opt into
the protected command profile and enroll an admitted projection/key read in the
active unit of work. Source-checked at Arc v22.72.0 `ProtectedDecisionAttribute.cs`
and `CommandDecisionReads.cs`, Chronicle v19.50.0 `DecisionRead.cs`/`IDecisionReads.cs`.
Stage does not turn `.play` `reads`/`require` into protected decisions. Upgrading Arc or Chronicle inside a rendered application is a re-render under a newer
Stage, not an edit of the managed files. Hand-written scope that needs a newer Arc (for example a
reactor returning events and commands) can raise the version through `Customizations/Dependencies.props`
(explicit `Version`, imported last; central management is off), but whether that override restores
cleanly beside the managed 22.68.0 reference is **unverified**: prove it with a restore and build. The compose file binds local ports `27017` and
`35000`, keeps data in the named volumes `chronicle-data` and `chronicle-config`, and
`docker compose down --volumes` is the only thing that deletes them.

## What is managed

Every path in `.cratis-render.json` is managed: the scaffold files (project, solution,
`Program.cs`, `GeneratedPolicyRegistration.cs`, `appsettings.json`, `docker-compose.yml`,
the three `Directory.*` files, `package.json`, `tsconfig.json`, `.gitignore`,
`.frontend/*`), `scene.json`, `src/bindings.ts` and everything rendered from the model
(concepts, slice folders, policies, Debug specifications). Editing any of them is lost or
refused on the next render. The application identity from `--name` becomes the
Chronicle event-store name in `appsettings.json` and the default project name and root
namespace.

Whether modeled `screen` declarations become faithful screens is a runtime question, not a
publication result: the Stage 4.73.1 scaffold emits Arc `CommandForm` shells over Scene typed
bindings and navigation contributions, but claim UI fidelity only from a browser run
(`SKILL.md`, UI parity). Screens stay managed.

## `Customizations/` (unmanaged)

The top-level `Customizations/` folder is reserved and user-owned. No plan contains a path
there (a module or feature that would render into it fails with `STAGE-CRATIS-005`), and
the planner never reads it, so it can neither break nor repair a render.

| File | Use | Picked up when |
| --- | --- | --- |
| `Customizations/Program.cs` | Service registrations, options, extra endpoints or middleware, through the partial methods `ConfigureServices(WebApplicationBuilder)` and `ConfigureApplication(WebApplication)` | the project compiles |
| `Customizations/*.cs` | Adapters and other types | the project compiles |
| `Customizations/Dependencies.props` | Project and package references, MSBuild properties; imported last | MSBuild evaluates the project |
| `Customizations/styles.css` | Font and `--cratis-*` token overrides | Vite builds or serves the frontend |

Every file is optional. Rules that bite:

- `Customizations/Program.cs` stays in the global namespace and declares
  `partial class Program` with exactly the managed signatures (`static partial void ...`);
  a namespace or a changed signature fails with `CS0759`.
- `ConfigureServices` runs after `AddCratis` and before `Build`; `ConfigureApplication`
  runs last, after the generated middleware and endpoints. The last registration of a
  service wins, so do not re-register Cratis types unless you mean to replace them.
- Configuration comes from environment variables or other sources, not from
  `appsettings.json` (managed). Keep secrets out of files under `Customizations/`.
- A `PackageReference` in `Dependencies.props` needs an explicit `Version`.
- Endpoints sit under `/api` (the Vite dev server proxies it) on a path that cannot collide
  with a route Arc generates.
- `package.json` is managed, so `styles.css` cannot add npm dependencies. Restart the dev
  server after creating or deleting the file.
- Mapped endpoints are anonymous unless secured with ASP.NET Core authorization;
  modeled authorization covers only what Stage renders.

What the seam does **not** do: it binds no modeled reaction or capture, runs no
Automation or Translate slice and renders nothing. An automation or translation is
hand-written (gap-fill) with its adapters and DI registration here, and the model remains
its contract. Keep `Customizations/` under version control: whether a re-render keeps
it depends on the publisher, and `cratis render` writes only the planned paths and
refuses unmanaged files at them.

## Re-render checklist

1. Commit or stash local work; `Customizations/` is untracked by Stage, not protected by it.
2. Render from the same model folder with the same `--name` and `--destination`.
3. On a refusal for a modified managed file, find out why it was edited. Move the intent
   into the model or `Customizations/`, then re-render; use `--force` only to discard the
   edit on purpose.
4. A result with `recovered: true` stops the work until the destination is reconciled.
5. Build and test in Debug (separate results); do not infer them from the render.
