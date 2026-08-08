# Running the Planner locally

## Prerequisites

- .NET 10 SDK
- Node.js 20+ with corepack (Yarn 4)
- Docker (Desktop or any engine) - runs MongoDB, Chronicle and the worker containers

## One-time setup

```shell
yarn install
docker build -t cratis/planner-worker:latest Source/Claude
```

The worker image is what scheduled work runs in; build it locally so the scheduler can start
containers without pulling from Docker Hub.

## Run everything with Aspire

```shell
dotnet run --project Source/Composition
```

The Composition AppHost starts:

- **MongoDB** as a self-initiating single-node replica set (Chronicle needs transactions and
  change streams, which a standalone `mongod` does not support),
- **Chronicle** (the `cratis/chronicle` development-slim image) wired to that MongoDB,
- the **Planner backend** on <http://localhost:5200>,
- the **Planner frontend** (Vite dev server) on <http://localhost:9100>.

The Aspire dashboard opens automatically and is configured passwordless
(`ASPIRE_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS`) - no login token needed.

Open <http://localhost:9100> for the application. The Vite dev server proxies `/api`, `/.cratis`,
`/scalar` and `/openapi` to the backend.

## First steps

1. Under **Claude Accounts**, register an account with a token from `claude setup-token`.
2. Under **Repositories**, add an organization (discovers all its repositories) or a single
   repository. The initial issue load starts immediately - it needs `Planner:GitHub:Token` set,
   e.g. through user secrets:

   ```shell
   dotnet user-secrets set "Planner:GitHub:Token" "<token>" --project Source/Planner
   ```

3. Mark an issue **Ready for development** - the scheduler picks it up within a minute and starts
   a worker container. Follow it on the **Work** page or with `docker ps`.

## Webhooks locally

GitHub cannot reach your machine directly - use a tunnel (e.g. `gh webhook forward`,
`smee.io` or `ngrok`) pointing at `http://localhost:5200/webhooks/github`. Without webhooks the
mirror still works through the initial load and the daily consolidation - or trigger a manual
sync by re-adding the repository.

## Running the backend alone

The backend can run without Aspire against already-running infrastructure:

```shell
dotnet run --project Source/Planner    # expects Chronicle on :35000 and MongoDB on :27017
cd Source/Planner && yarn dev          # frontend on :9100
```

## Quality gates

```shell
dotnet build Source/Planner/Planner.csproj -c Debug     # zero warnings - specs compile
dotnet build Source/Planner/Planner.csproj -c Release   # zero warnings - regenerates proxies
dotnet test Source/Planner/Planner.csproj -c Debug      # all specs green
cd Source/Planner
yarn test && yarn lint:ci && yarn compile && yarn build # frontend gates
```
