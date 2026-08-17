---
name: getting-started
description: Go from nothing to a running Cratis application with one working vertical slice — install the Cratis.Templates package, scaffold with dotnet new, start Chronicle and MongoDB, run the backend and the Vite frontend, and verify it works. Use for "how do I start a new Cratis project", "set up a Cratis app", "dotnet new cratis", first run, local development environment, or when a repository has no Cratis application in it yet.
---

# Getting Started with Cratis

Every other application skill in this corpus assumes an application that already builds and runs.
This one creates that application. It ends where `scaffold-feature` and `new-vertical-slice` begin.

## When to use this skill

Use it when there is **no running Cratis application yet** — an empty repository, a fresh clone
that has never been started, or a developer asking how to begin. If a Cratis app already builds
and runs, skip to `scaffold-feature`.

## Prerequisites

| Need | Version | How to check | Why |
|---|---|---|---|
| .NET SDK | **10.0** (templates default to `net10.0`; `net8.0`/`net9.0` are selectable) | `dotnet --version` | Builds the backend and runs the proxy generator |
| Node.js | 20.19+, 22.13+, or 24+ | `node --version` | Vite dev server and the React frontend |
| Yarn 4 | via corepack | `corepack enable && yarn --version` | Default package manager of the `cratis` template |
| Docker | any engine, running | `docker info` | Runs Chronicle and MongoDB |
| `cratis` CLI | optional | `cratis version` | Inspect the running store — see `running-and-debugging` |

**MongoDB must be a replica set.** Chronicle needs transactions and change streams, which a
standalone `mongod` does not support. The development container handles this for you; if you
point Chronicle at your own MongoDB, initiate a replica set first. See
[Local infrastructure](./references/local-infrastructure.md).

## Steps

### Step 1 — Install the templates

The templates ship as one NuGet package, `Cratis.Templates`:

```bash
dotnet new install Cratis.Templates
```

Update later with `dotnet new update`, or `dotnet new uninstall Cratis.Templates` then reinstall.

### Step 2 — Pick the template

Four short names are installed. Pick by what you are building:

| Short name | Produces | Choose it when |
|---|---|---|
| `cratis` | One web project: Arc + Chronicle + React/Vite frontend, `docker-compose.yml`, sample slices | **Default.** You are building a Cratis application |
| `cratis-aspire` | A solution: the same web app plus a `.Composition` Aspire AppHost and a `.Infrastructure` service-defaults project | You want Aspire to orchestrate Chronicle and the backend, with OpenTelemetry wired up |
| `cratis-chronicle-web` | A minimal ASP.NET Core app that talks to Chronicle. No Arc, no frontend | You are learning Chronicle alone, or adding an event store to an existing service |
| `cratis-chronicle-console` | A console app using `ChronicleClient` | Smallest possible Chronicle experiment |

Full parameters, emitted file layouts, and the generated `.csproj` proxy settings are in
[The four templates](./references/templates.md).

### Step 3 — Scaffold

```bash
dotnet new cratis -n MyApp -o MyApp
cd MyApp
```

Post-creation actions resolve the `Version="*"` package references to current versions and run
`yarn install`. In an interactive terminal `dotnet new` asks first. **Non-interactively** — CI, a
script, a devcontainer `postCreateCommand`, or an agent — opt in explicitly or nothing is pinned
and no dependencies are installed:

```bash
dotnet new cratis -n MyApp -o MyApp --allow-scripts yes
```

To pin package versions but skip the frontend install, pass `--allow-scripts yes --packageManager none`.

### Step 4 — Start the infrastructure

```bash
docker compose up -d
```

The `cratis` template's compose file starts two services:

| Service | Image | Ports | What it is |
|---|---|---|---|
| `chronicle` | `cratis/chronicle:latest-development` | 35000 (clients), 27017 (MongoDB), 8080, 11111, 30000 | Chronicle server **with an embedded MongoDB**, started as single-node replica set `rs0` |
| `aspire-dashboard` | `mcr.microsoft.com/dotnet/aspire-dashboard:latest` | 18888 (UI), 4317 (OTLP) | Traces, metrics, and logs |

The generated `appsettings.json` points at exactly these:

```json
"Chronicle": {
    "EventStore": "MyApp",
    "ConnectionString": "chronicle://chronicle-dev-client:chronicle-dev-secret@localhost:35000"
},
"MongoDB": {
    "Server": "mongodb://localhost:27017",
    "Database": "MyApp"
}
```

Those are **development credentials baked into the development image** — never a production value.

With `cratis-aspire` there is no compose file: `dotnet run --project MyApp.Composition` starts
Chronicle, the backend, and the dashboard together.

### Step 5 — Build the backend, in Debug, before touching the frontend

```bash
dotnet build -c Debug
```

**This is the step first-day failures come from.** The TypeScript command and query proxies the
React code imports do not exist in source control — the proxy generator emits them during a
**Debug** build. Run the frontend before a successful Debug build and TypeScript fails with
`Cannot find module` on every proxy import, which reads like a broken template but is only a
missing build.

**Backend before frontend, always.** See the proxy-generation note in
[general.md](../../rules/general.md). When you later build Release just to check it compiles,
skip regeneration so the second build cannot touch already-correct generated files:

```bash
dotnet build -c Release -p:CratisProxiesOutputPath=
```

### Step 6 — Run it

Two processes, two terminals:

```bash
dotnet run          # backend
yarn dev            # Vite dev server, in the project root
```

| Surface | URL | Notes |
|---|---|---|
| Frontend (Vite dev server) | <http://localhost:9000> | Set in `.frontend/vite.config.ts`; opens automatically |
| Backend API | <http://localhost:5000> | What the Vite proxy forwards `/api`, `/.cratis`, and `/swagger` to |
| Swagger UI | <http://localhost:5000/swagger> | `cratis` template only |
| Aspire dashboard | <http://localhost:18888> | From the compose file |

> The scaffolded project ships **no** `Properties/launchSettings.json` — it is excluded from the
> template package — so the backend URL is not pinned by the template while the Vite proxy
> hard-codes `http://localhost:5000`. If your backend binds elsewhere, set `ASPNETCORE_URLS` or
> add a launch profile so the two agree, or every frontend request 404s against the dev server.
>
> The `cratis` template's own generated `README.md` says the frontend runs on port 5173. The Vite
> config it ships says `9000`. **The config wins.**

### Step 7 — Confirm it actually worked

Do not stop at "it compiled". Check, in order:

1. `docker compose ps` — both services up.
2. The backend log shows Chronicle connected, with no repeated reconnect attempts.
3. <http://localhost:9000> renders the sample page from `SomeModule/SomeFeature`.
4. Exercise the sample slice's command from the UI, then confirm the sample listing updates —
   that proves command → event → projection → read model → query → proxy end to end.
5. Optionally, point the CLI at the store: `cratis chronicle diagnose` (see `running-and-debugging`).

If any step fails, go to [First-day failures](./references/local-infrastructure.md#first-day-failures)
before changing code.

### Step 8 — Hand off to the slice workflow

The template's `SomeModule/SomeFeature` is a worked example, not your domain — read it, then
replace it. From here the corpus takes over:

- **`scaffold-feature`** — create the feature folder, composition page, route, and nav entry.
- **`new-vertical-slice`** — build the first real slice end-to-end (backend → build → specs → frontend).
- **`event-modeling`** — run this first when the event vocabulary or stream boundaries are not settled.

## Completion checklist

- [ ] `dotnet new install Cratis.Templates` succeeded and the short name is listed by `dotnet new list`
- [ ] Project scaffolded; package versions pinned and frontend dependencies installed
- [ ] `docker compose up -d` (or the Aspire AppHost) is running — Chronicle reachable on 35000
- [ ] `dotnet build -c Debug` clean, zero warnings — TypeScript proxies exist next to the C# sources
- [ ] `dotnet build -c Release -p:CratisProxiesOutputPath=` clean
- [ ] Backend and Vite dev server both running; the sample page renders
- [ ] The sample command runs and its read model updates
- [ ] Sample slices removed or replaced before real work starts

## See also

- [The four templates](./references/templates.md) — parameters, layouts, generated project settings.
- [Local infrastructure](./references/local-infrastructure.md) — images, ports, replica sets, first-day failures.
- `running-and-debugging` — inspect and repair the running event store with the `cratis` CLI.
- `scaffold-feature`, `new-vertical-slice`, `event-modeling` — the next steps.
- [general.md](../../rules/general.md) — implementation workflow, quality gates, proxy generation.
