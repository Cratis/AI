# The rendered application: scaffold, managed files and `Customizations/`

Read at Stage `v4.24.0` (`Scaffolding/CratisBackendApplicationScaffold*.cs`,
`CratisFrontendApplicationScaffold.cs`, `README.md`,
`Documentation/guides/customize-rendered-application.md`) and checked against a real
render (see [render-example.md](render-example.md)).

## Scaffold pins

| Item | Value |
| --- | --- |
| Target framework | .NET 10 (`net10.0`), `Microsoft.NET.Sdk.Web` |
| Arc packages (`Cratis`, `Cratis.Arc.MongoDB`, Arc testing) | `22.25.0` |
| Chronicle client | `Cratis.Chronicle` and `.AspNetCore` `19.8.1`, matched to the `cratis/chronicle:19.8.1-development` image in the compose file |
| Test packages | xunit, NSubstitute, Cratis.Specifications; **Debug configuration only** (`IsTestProject` when Debug) |
| Frontend | Vite and React, Components `4.14.0`, Scene `4.2.0`, Fundamentals `7.19.6` |
| Package management | central package management **off**; `Directory.Packages.props` is managed, do not edit it |

Consequences: `[ProtectedDecision]` and `DecisionRead<T>` (Arc 22.39.0 and later) are not
available in a rendered application; `[ExecuteCommandsAsSystem]` (Arc 20.56.0 and later)
is. Upgrading Arc or Chronicle inside a rendered application is a re-render under a newer
Stage, not an edit of the managed files. The compose file binds local ports `27017` and
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

Whether modeled `screen` declarations become faithful screens in the frontend was not
verified. The scaffold is a working shell, and the customization guide says screens stay
managed; do not claim UI fidelity from a published render.

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
