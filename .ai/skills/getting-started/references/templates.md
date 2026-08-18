# The four Cratis templates

Everything here was read from the template sources in the `Cratis/Templates` repository —
each template's `.template.config/template.json` plus the files it emits. Where a template's
own generated `README.md` disagrees with the code it ships, the code wins and this page says so.

## Installing

The package id is `Cratis.Templates`. One package, four templates.

```bash
dotnet new install Cratis.Templates              # latest
dotnet new install Cratis.Templates::<version>   # a specific version
dotnet new update                                # update everything installed
dotnet new uninstall Cratis.Templates            # remove
```

`dotnet new list` shows what is installed and the version you have. Prerelease builds come from
GitHub Packages — add that source first, then install with `--nuget-source`.

## The templates

| Short name | Template name | Identity | Kind |
|---|---|---|---|
| `cratis` | Cratis Web Application | `Cratis.Templates.Web` | project |
| `cratis-aspire` | Cratis Aspire Application | `Cratis.Templates.Aspire` | solution |
| `cratis-chronicle-web` | Cratis Chronicle Web | `Cratis.Templates.ChronicleWeb` | project |
| `cratis-chronicle-console` | Cratis Chronicle Console | `Cratis.Templates.ChronicleConsole` | project |

Every template takes `-n <Name>` (the name replaces the template's source name throughout) and
`-o <Dir>`. `dotnet new <shortname> --help` lists that template's own parameters.

### `cratis` — the default

One web project holding backend and frontend together.

#### Parameters

| Parameter | Values | Default |
|---|---|---|
| `--Framework` | `net8.0`, `net9.0`, `net10.0` | `net10.0` |
| `--packageManager` | `yarn`, `pnpm`, `npm`, `none` | `yarn` |

#### Emits

```text
MyApp.csproj  MyApp.sln  Program.cs  GlobalUsings.cs
appsettings.json  appsettings.Development.json
docker-compose.yml  package.json  tsconfig.json  eslint.config.mjs
App.tsx  Home.tsx
.frontend/           index.html  main.tsx  index.css  vite.config.ts  tsconfig*.json
SomeModule/SomeFeature/
    SomeName.cs  SomeFeature.tsx  index.ts
    Registration/  Registration.cs  Register.ts  RegisterDialog.tsx  index.ts
    Listing/       Listing.cs  Listing.ts  AllListings.ts  ListingPage.tsx  index.ts
```

`SomeModule/SomeFeature` is a worked example of the module → feature → slice layout, with one
State Change slice (`Registration`) and one State View slice (`Listing`). The `.ts` files beside
each `.cs` file are generated proxies — read them, then delete the whole sample.

**Bootstrap** — the template's `Program.cs` uses the combined `Cratis` metapackage entry point,
which wires Arc and Chronicle together in one call:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddCratis(
    configureChronicleBuilder: chronicleBuilder => chronicleBuilder.WithCamelCaseNamingPolicy(),
    configureArcBuilder: arcBuilder => arcBuilder.WithMongoDB(configureMongoDB: builder => builder.WithCamelCaseNamingPolicy()));

var app = builder.Build();
app.UseRouting();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseWebSockets();
app.MapControllers();
app.UseCratis();
app.MapFallbackToFile("/index.html");
await app.RunAsync();
```

`AddCratis` extends `WebApplicationBuilder` and lives in the `Cratis` metapackage; it calls
`AddCratisArc`, attaches Chronicle, and adds Microsoft Identity Platform authentication.
`UseCratis` extends `IApplicationBuilder` and takes no arguments.

**There is a second, different bootstrap and the two are not interchangeable.**
`ArcApplication.CreateBuilder(args)` (package `Cratis.Arc.Core`) is the self-hosted path with no
ASP.NET underneath; it pairs with the `ArcApplicationBuilder` overload of `AddCratisArc` and the
`ArcApplication` overload of `UseCratisArc`. `AddCratis` extends `WebApplicationBuilder`, and
`ArcApplicationBuilder` is not one, so `AddCratis` is not in scope on the self-hosted path at
all — reaching for it is a compile error, not a runtime failure. Attach Chronicle there with
`AddCratisArc(configureBuilder: arc => arc.WithChronicle())`, which binds the
`Cratis.Arc.Chronicle` overload; the metapackage ships a same-named `WithChronicle` that casts
the underlying builder to `WebApplicationBuilder`. Templates target ASP.NET, so use the shape
above; see [writing-correct-examples.md](../../../rules/writing-correct-examples.md) for the
self-hosted one, and take the shape from whichever packages your project actually references.

**Package references** are `Cratis` and `Cratis.Arc.MongoDB`, both `Version="*"` in the template
source. The post-creation action resolves and pins them, which is why `--allow-scripts yes`
matters when scaffolding without a TTY.

**Generated project settings** control proxy generation and must stay aligned with the runtime
route settings in `appsettings.json`:

| `.csproj` property | Value | `appsettings.json` counterpart |
|---|---|---|
| `CratisProxiesOutputPath` | `$(MSBuildThisFileDirectory)` | — |
| `CratisProxiesSegmentsToSkip` | `1` | `Cratis:Arc:GeneratedApis:SegmentsToSkipForRoute` = `1` |
| `CratisProxiesSkipCommandNameInRoute` | `true` | `Cratis:Arc:GeneratedApis:IncludeCommandNameInRoute` = `false` (inverse) |
| `CratisProxiesSkipOutputDeletion` | `true` | — |
| `CratisProxiesUseSourceFileAsOutputFile` | `true` | — |
| — | — | `Cratis:Arc:GeneratedApis:RoutePrefix` = `api` ↔ `CratisProxiesApiPrefix` |

Out of sync, the generated TypeScript calls routes the backend never mapped — a 404 that looks
like a frontend bug.

### `cratis-aspire`

Same application, orchestrated by .NET Aspire instead of Docker Compose.

**Parameters:** `--Framework` — `net9.0` or `net10.0`, default `net10.0`. No package-manager
choice; this template does **not** auto-install frontend dependencies, so run `yarn install`
in the web project yourself.

**Emits** a solution with three projects:

| Project | Role |
|---|---|
| `MyApp/` | The web application — identical shape to the `cratis` template |
| `MyApp.Composition/` | The Aspire AppHost. `builder.AddCratisChronicle()` plus `AddProject<Projects.MyApp>("backend").WithReference(chronicle).WaitFor(chronicle)` |
| `MyApp.Infrastructure/` | Service defaults — OpenTelemetry, health checks (`/health`, `/alive`), service discovery, HTTP resilience |

Run it with `dotnet run --project MyApp.Composition`. Aspire starts Chronicle and the backend
and supplies the connection details, which is why this template's `appsettings.json` carries an
`EventStore` name but **no** Chronicle connection string and no MongoDB server.

### `cratis-chronicle-web`

A minimal ASP.NET Core app that talks to Chronicle directly — no Arc, no React, no vertical
slices. `--Framework` is `net8.0`/`net9.0`/`net10.0`, default `net10.0`.

Its `Program.cs` is the smallest complete Chronicle example there is: `AddCratisChronicle()` on
the builder, `UseCratisChronicle()` on the app, then a `[EventType]` record, a model-bound
projection, a reactor, and two endpoints that append and read. Ships `docker-compose.yml`.

### `cratis-chronicle-console`

The same Chronicle concepts with no web host at all — `new ChronicleClient()`,
`GetEventStore(...)`, `EventLog.Append(...)`. Ships `docker-compose.yml`. Good for a
five-minute look at events and observers without ASP.NET in the way.

## Verified corrections to the generated documentation

| Claim in a template's generated `README.md` | What the shipped code says |
|---|---|
| Frontend dev server on port 5173 (`cratis`) | `.frontend/vite.config.ts` sets `server.port` to **9000** |
| Aspire dashboard on port 15888 (`cratis-aspire`) | The compose-based templates publish the dashboard on **18888**; verify the Aspire-assigned port from its own console output |
| ".NET 9.0 or later" prerequisite | Both templates default `--Framework` to `net10.0`, and the Templates repository pins SDK `10.0.0` |

One more inconsistency worth knowing: the shipped `vite.config.ts` aliases `Api` to a sibling
`Features` directory, while `CratisProxiesOutputPath` writes proxies next to their C# sources.
The alias is vestigial — import proxies by relative path from the slice folder, as the sample
slices do.

## Non-interactive scaffolding

`dotnet new` prompts before running post-creation actions when stdin is a TTY. In CI, scripts,
devcontainer `postCreateCommand`, or an agent session it does not prompt — it skips them — so
package versions stay unresolved and no frontend dependencies get installed:

```bash
dotnet new cratis -n MyApp -o MyApp --allow-scripts yes
dotnet new cratis -n MyApp -o MyApp --allow-scripts yes --packageManager none   # pin versions, skip yarn
```
