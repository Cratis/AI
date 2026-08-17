# Running the Planner locally

## Prerequisites

- .NET 10 SDK
- Node.js 20+ with corepack (Yarn 4)
- Docker (Desktop or any engine) - runs MongoDB, Chronicle and the worker
  containers

## One-time setup

```shell
yarn install
docker build -t cratis/planner-worker:latest Source/Claude
```

The worker image is what scheduled work runs in; build it locally so the
scheduler can start containers without pulling from Docker Hub.

## Run everything with Aspire

```shell
dotnet run --project Source/Composition
```

The Composition AppHost starts:

- **MongoDB** as a self-initiating single-node replica set (Chronicle needs
  transactions and change streams, which a standalone `mongod` does not
  support),
- **Chronicle** (the `cratis/chronicle` development-slim image) wired to that
  MongoDB,
- the **Planner backend** on <http://localhost:5200>,
- the **Planner frontend** (Vite dev server) on <http://localhost:9100>.

The Aspire dashboard opens automatically and is configured passwordless
(`ASPIRE_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS`) - no login token needed.

Open <http://localhost:9100> for the application. The Vite dev server proxies
`/api`, `/.cratis`, `/scalar` and `/openapi` to the backend.

> [!CAUTION]
> The local composition runs with `Planner:Security:AllowUnauthenticatedOperators`
> set to `true` (in `appsettings.Development.json`), which treats **every** caller
> as a fully privileged operator - that is what keeps steering, log streaming and
> the protected commands working with no proxy in front of the app. The Aspire
> dashboard is unsecured and the Vite development server binds beyond loopback.
> Keep every surface isolated by the host firewall and do not enter real Claude or
> GitHub credentials into an instance reachable by other users.

A deployed Planner is the opposite: it trusts nobody until
`Planner:Security:ForwardedUserHeader` names the header its authenticating ingress
records the operator's login in, and both webhook secrets reject every delivery
until they are configured. See
[the security boundary](./running-in-the-cloud.md#the-security-boundary) for what
the Planner enforces and what the ingress must.

## Credential-free first steps

1. Open the Planner and inspect the Issues, Work, Repositories, Pull Requests,
   Usage, and Alerts surfaces.
2. Verify that the local composition is healthy in the Aspire dashboard.
3. Stop here unless the environment has the reviewed ingress and authentication
   boundary described below.

## Enabling real work in a trusted environment

Real work requires a Claude setup token, a configured GitHub App, and external
GitHub callbacks. Do not add those credentials to the default local composition
or expose port 5200 or 9100 through an unrestricted public tunnel.

Before enabling real work, provide a reviewed ingress that:

- authenticates all operator, UI, API, query-stream, and setup surfaces;
- uses TLS and denies every route that is not explicitly required;
- overwrites the header named by `Planner__Security__ForwardedUserHeader` on every
  inbound request, so no caller can name themselves an operator;
- permits GitHub webhook delivery only to `/webhooks/github`, with a non-empty
  `Planner__GitHubApp__WebhookSecret` and verified HMAC signatures;
- treats `/github-app/created` and `/github-app/installed` as browser-return
  paths available only in an authenticated operator session; and
- does not expose `/`, `/api`, `/.cratis`, `/openapi`, `/scalar`, the Vite
  server, or the Aspire dashboard to unauthenticated callers.

There is currently no supported raw-tunnel recipe for the unauthenticated local
app. The ingress and callback design must receive a security review for the
actual environment before real credentials or work are used. Once that boundary
exists:

1. Under **Claude Accounts**, register an account with a token from
   `claude setup-token`.
2. Under **GitHub**, connect a GitHub App - see
   [Setting up the GitHub App](./github-app-setup.md).
3. Under **Repositories**, add an organization (discovers all its repositories)
   or a single repository. The initial issue load starts immediately,
   authenticated through the connected App.
4. Mark an issue **Ready for development** - the scheduler picks it up within a
   minute and starts a worker container. Follow it on the **Work** page or with
   `docker ps`.

## Webhooks locally

GitHub cannot reach `localhost` directly. Do not point `ngrok`, another public
tunnel, or a generic port-forward at the Planner backend. Use only the reviewed,
authenticated, route-restricted ingress described above. Without callbacks, do
not use real GitHub App credentials or dispatch real work from the default local
composition.

## Running the backend alone

The backend can run without Aspire against already-running infrastructure. Both
processes stay in the foreground, so run each in its **own terminal**:

```shell
# Terminal 1 — backend
dotnet run --project Source/Planner
```

```shell
# Terminal 2 — frontend
cd Source/Planner
yarn dev
```

The backend expects Chronicle on port 35000 and MongoDB on port 27017. The
frontend runs on port 9100.

## Quality gates

```shell
dotnet build Source/Planner/Planner.csproj -c Debug
dotnet build Source/Planner/Planner.csproj -c Release -p:CratisProxiesOutputPath=
dotnet test Source/Planner/Planner.csproj -c Debug
cd Source/Planner
yarn test && yarn lint:ci && yarn compile && yarn build
```

The **Debug** build is the one that compiles the `#if DEBUG` specification code
and regenerates the TypeScript proxies — run it before anything that consumes
them. The Release build is a build-only check that the code compiles with
warnings treated as errors; the empty `CratisProxiesOutputPath` clears the
property the proxy generator's MSBuild target is conditioned on, so that second
build cannot re-run the generator over already-correct generated files. All
commands must complete without warnings or test failures.
