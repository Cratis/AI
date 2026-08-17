# Local infrastructure — Chronicle, MongoDB, Aspire

What actually runs on your machine when a Cratis application starts, which ports it claims, and
the small number of things that go wrong on day one. Ports and image names below come from the
`docker-compose.yml` the templates emit and from the Chronicle repository's Docker sources.

## The two ways to start Chronicle

### Docker Compose — what `cratis`, `cratis-chronicle-web`, and `cratis-chronicle-console` emit

All three ship the same compose file:

```yaml
services:
  chronicle:
    image: cratis/chronicle:latest-development
    pull_policy: always
    environment:
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://aspire-dashboard:18889
    ports:
      - 27017:27017
      - 8080:8080
      - 11111:11111
      - 30000:30000
      - 35000:35000

  aspire-dashboard:
    image: mcr.microsoft.com/dotnet/aspire-dashboard:latest
    environment:
      - DOTNET_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS=true
      - DOTNET_DASHBOARD_OTLP_ENDPOINT_URL=http://chronicle:18889
      - ALLOW_UNSECURED_TRANSPORT=true
      - DOTNET_ENVIRONMENT=Development
    ports:
      - 18888:18888
      - 4317:18889
```

```bash
docker compose up -d      # start
docker compose ps         # both services up?
docker compose logs -f chronicle
docker compose down       # stop, keep data
docker compose down -v    # stop and discard the event store
```

| Port | What answers on it |
|---|---|
| 35000 | Chronicle client connections — what `Cratis:Chronicle:ConnectionString` points at, and what the `cratis` CLI connects to |
| 27017 | The MongoDB embedded in the development image |
| 8080 | The Chronicle Workbench (browser UI) |
| 11111, 30000 | Chronicle silo/clustering ports |
| 18888 | Aspire dashboard UI — traces, metrics, logs |
| 4317 | OTLP ingest, mapped to the dashboard's 18889 |

### Aspire — what `cratis-aspire` emits

No compose file. `dotnet run --project MyApp.Composition` starts everything:

```csharp
var builder = DistributedApplication.CreateBuilder(args);
var chronicle = builder.AddCratisChronicle();
builder.AddProject<Projects.MyApp>("backend")
    .WithReference(chronicle)
    .WaitFor(chronicle);
builder.Build().Run();
```

Aspire injects the Chronicle connection details, which is why the Aspire template's
`appsettings.json` names an event store but carries no connection string. Read the actual
assigned ports from the AppHost console output or the dashboard rather than assuming them.

## MongoDB must be a replica set

**This is the trap that costs a whole first day.** Chronicle needs transactions and change
streams, and a standalone `mongod` supports neither. Point Chronicle at a plain single MongoDB
and it fails at startup or silently never observes anything.

The `cratis/chronicle:latest-development` image handles this for you: its entrypoint starts
`mongod --replSet rs0`, waits for it, and initiates a single-node replica set before starting the
Chronicle server. That is why the compose file has one service yet publishes 27017.

Two consequences worth knowing:

- **Bringing your own MongoDB?** Initiate a replica set — even a single-node one — before
  Chronicle connects. Any local composition that runs MongoDB as its own container must do the
  same; a self-initiating single-node replica set is the standard local shape.
- **Which image?** `cratis/chronicle:latest-development` bundles Chronicle *and* MongoDB. The
  slim variant is the Chronicle server **only**, with no embedded MongoDB — use it when you are
  supplying the database yourself, and expect to wire the replica set up on your side.

Chronicle also supports SQL storage backends, in which case the embedded `mongod` is not started
at all. That is a deliberate configuration, not the default.

## Development credentials are not secrets

The generated `appsettings.json` contains:

```text
chronicle://chronicle-dev-client:chronicle-dev-secret@localhost:35000
```

These are well-known credentials baked into the development image so a local store needs no
setup. They belong nowhere near a deployed environment. The `cratis` CLI knows them too, which
is why it connects to a local Chronicle with nothing configured.

## First-day failures

| Symptom | Cause | Fix |
|---|---|---|
| TypeScript `Cannot find module` on every proxy import | Proxies are generated during a **Debug** build and are not in source control; you built Release, or only ran the frontend | `dotnet build -c Debug`, then start the frontend. Backend before frontend, always |
| Frontend loads but every request 404s | The Vite proxy targets `http://localhost:5000` and the backend bound somewhere else. The template ships no launch profile, so nothing pins the port | Set `ASPNETCORE_URLS=http://localhost:5000`, add a launch profile, or change the proxy target in `.frontend/vite.config.ts` |
| Backend cannot connect to Chronicle | Container not up, or still initiating its replica set — startup is not instant | `docker compose ps`, then `docker compose logs chronicle` and wait for the server to report ready |
| Chronicle starts, but nothing is ever observed | MongoDB is not a replica set (only possible when supplying your own) | Initiate a replica set; verify with `rs.status()` |
| Backend starts, command succeeds, read model stays empty | A projection or reactor issue, not an environment issue | `cratis chronicle diagnose` — see the `running-and-debugging` skill; then `diagnose-slice` for the code-level cause |
| `dotnet new` produced a project with `Version="*"` still unresolved and no `node_modules` | Post-creation actions were skipped because stdin was not a TTY | Re-scaffold with `--allow-scripts yes`, or resolve versions and run the install manually |
| Port already in use on 27017 or 35000 | A previously running Chronicle, or a local MongoDB | `docker compose down`, stop the other service, or remap the port in the compose file *and* in `appsettings.json` |
| Frontend dependency install fails on an unexpected yarn version | Yarn 4 comes through corepack, not a global install | `corepack enable`, then `yarn --version` |

## Quality gates once it runs

The application-wide gates apply from the first slice onward — see
[general.md](../../../rules/general.md):

```bash
dotnet build -c Debug                                   # zero warnings; regenerates proxies
dotnet build -c Release -p:CratisProxiesOutputPath=     # zero warnings; skips regeneration
dotnet test
yarn lint
yarn build
```
