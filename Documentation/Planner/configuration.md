# Configuring the Planner

All configuration lives in `appsettings.json` and can be overridden with environment variables
(`__` as the section separator, e.g. `Planner__GitHubApp__AppId`).

## Cratis

| Key | Default | Purpose |
| --- | --- | --- |
| `Cratis:Chronicle:ConnectionString` | `chronicle://localhost:35000` | The Chronicle kernel the events live in |
| `Cratis:MongoDB:Server` | `mongodb://localhost:27017` | MongoDB for the Arc read models |
| `Cratis:MongoDB:Database` | `Planner` | The read model database name |

## GitHub - `Planner:GitHub`

| Key | Default | Purpose |
| --- | --- | --- |
| `ApiBaseUrl` | `https://api.github.com` | GitHub REST API base URL (change for GitHub Enterprise) |

## GitHub App - `Planner:GitHubApp`

The Planner authenticates with GitHub as a **GitHub App**, not a personal access token - see
[Setting up the GitHub App](./github-app-setup.md) for the full walkthrough. Every worker
container's `GITHUB_TOKEN` and every GitHub REST call are short-lived installation access tokens
minted from these credentials, never a long-lived static token.

| Key | Default | Purpose |
| --- | --- | --- |
| `AppId` | *(empty)* | The numeric App id GitHub assigned |
| `Slug` | *(empty)* | The App's URL-friendly slug - used to build the installation URL |
| `Name` | *(empty)* | The App's display name |
| `Organization` | `Cratis` | The organization the App is registered under and installed into. Empty registers a personal App instead |
| `PrivateKeyPem` | *(empty)* | The App's private key (PEM) - signs the JWTs the App authenticates with |
| `WebhookSecret` | *(empty)* | The secret GitHub signs webhook deliveries with. When empty, signature validation is skipped - local development only |

These are generated for you by the **Connect GitHub App** button on the *GitHub* settings page
(the manifest-flow registration) - copy the values it displays into configuration or secrets, then
restart the Planner. Which accounts have installed the App is tracked separately as regular
application state (visible on the same settings page) since installations change at runtime,
unlike these credentials.

Point the App's webhook at `https://<planner-host>/webhooks/github` - the manifest already
configures this for you when using the **Connect GitHub App** flow.

## Git identity

Also **not** configuration - managed on the *GitHub* settings page. One `git config user.name` /
`user.email` pair, shared by the whole deployment, injected into every worker container as
`PLANNER_GIT_USER_NAME` / `PLANNER_GIT_USER_EMAIL` so commits it makes carry a real identity
instead of git's own unconfigured default.

## Worker - `Planner:Worker`

| Key | Default | Purpose |
| --- | --- | --- |
| `Image` | `cratis/planner-worker:latest` | The worker container image (built from `Source/Claude`) |
| `CallbackBaseUrl` | `http://host.docker.internal:5200` | The base URL workers report back to - must be reachable *from inside a worker container* |

## Scheduling - `Planner:Scheduling`

| Key | Default | Purpose |
| --- | --- | --- |
| `MaxConcurrentWorkPerAccount` | `1` | How many units of work may run concurrently per account |
| `MaxRunningDuration` | `1.00:00:00` (24 hours) | How long a unit of work may stay running before it is swept as presumed dead. `00:00:00` disables the sweep |
| `DefaultModel` | `sonnet` | The model for implementation work when nothing suggested one |
| `InvestigationModel` | `opus` | The model used for investigations |
| `Limits:<Plan>:SessionsPerFiveHours` | 1 / 3 / 6 | Sessions per rolling five-hour window for Pro / Max5x / Max20x |
| `Limits:<Plan>:SessionsPerWeek` | 40 / 120 / 240 | Sessions per rolling week for Pro / Max5x / Max20x |

The limits are deliberately conservative approximations of the Claude plan boundaries - tune them
to your accounts' real experience.

### The stuck-work sweep

A worker container that dies without reporting - an OOM kill, a node eviction, a crash - leaves its
work item `Running` forever: nothing else moves it out of that state, and since
`MaxConcurrentWorkPerAccount` defaults to `1`, one stuck item wedges its account indefinitely. Every
scheduling pass sweeps work that has been `Running` longer than `MaxRunningDuration`: it stops the
worker (best effort, in case it is somehow still around), revokes the worker's callback token, and
fails the work with a reason that says it was swept, not that it genuinely failed.

The worker runtime (Docker locally, Kubernetes in production) has no way to ask whether a container
is still alive, so the sweep can only go on elapsed time - it cannot tell a dead container from a
slow one. That is why the default is a generous 24 hours: an agent legitimately running for hours on
a hard issue is normal, and failing a container that is still working would be a worse outcome than
the bug this closes. Set `Planner:Scheduling:MaxRunningDuration` to `00:00:00` to disable the sweep
entirely, or to a smaller value (e.g. `04:00:00`) if your workloads are reliably short and you want
faster recovery.

## Alerts - `Planner:Alerts`

What arrives on the alert webhook and what happens to it - see [Alerts](./alerts.md).

| Key | Default | Purpose |
| --- | --- | --- |
| `WebhookSecret` | *(empty)* | The secret alert deliveries are signed with (`X-Planner-Signature-256`). When empty, unsigned deliveries are accepted - local development only |
| `AutoInvestigate` | `true` | Whether an agent is put on an alert the moment it arrives |
| `Model` | `opus` | The model alerts are investigated with |
| `DefaultSource` | `production` | The source recorded for a delivery that does not name one |

## Operations - `Planner:Operations`

The operational access an agent investigating an alert is given, and where operational issues are
filed. Everything is optional; what is left empty is simply not handed to the worker, and the
agent's prompt tells it what it can actually reach.

| Key | Default | Purpose |
| --- | --- | --- |
| `Kubeconfig` | *(empty)* | Full kubeconfig YAML, written to `~/.kube/config` in the worker for `kubectl` and `helm` |
| `KubernetesNamespace` | *(empty)* | The namespace made current in that kubeconfig |
| `DockerHost` | *(empty)* | The Docker daemon the worker's `docker` CLI talks to, as a `DOCKER_HOST` value |
| `LokiUrl` | *(empty)* | Base URL of Loki, e.g. `http://loki.studio.svc.cluster.local:3100` |
| `LokiUsername` / `LokiPassword` | *(empty)* | Loki credentials, when it is protected |
| `GrafanaUrl` | *(empty)* | Base URL of Grafana |
| `GrafanaToken` | *(empty)* | Grafana API token |
| `Repositories` | `[]` | Repositories cloned for an alert investigation, as `owner/name` - the code behind the system that alerts |
| `IssueOwner` / `IssueRepository` | *(empty)* | The repository operational issues default to when an alert is turned into an issue |
| `Runbook` | *(empty)* | Standing instructions appended to every alert investigation prompt |

> No database credentials are handed to an agent, by design. An agent that can read a cluster and
> its logs can explain almost any operational failure; one that can also read the data can leak it.

## Container runtime - `ContainerRuntime`

| Key | Default | Purpose |
| --- | --- | --- |
| `Type` | `Auto` | `Auto`, `Docker` or `Kubernetes`. `Auto` picks Kubernetes when running in a cluster, otherwise the local Docker engine |
| `DockerEndpoint` | *(auto)* | Explicit Docker daemon endpoint; defaults to `DOCKER_HOST` / the platform socket |
| `KubernetesNamespace` | `default` | The namespace worker jobs are created in |

## Orleans - `Planner:Orleans`

| Key | Default | Purpose |
| --- | --- | --- |
| `Enabled` | `true` | Co-hosts the Orleans silo (scheduler + consolidation grains) |
| `Clustering` | `Localhost` | `Localhost` (single instance) or `MongoDB` (shared cluster membership for multiple instances) |

An unrecognized `Clustering` value fails startup rather than quietly falling
back to `Localhost`.

`Clustering` picks the **membership** provider only. Reminders always come from Orleans' in-memory
reminder service, in both modes: the MongoDB provider is a 9.x binary and its reminder table hangs
the 10.x reminder service outright, so the Planner uses it for membership and nothing else. The
practical consequence is that reminders do not survive a full cluster restart - which costs nothing,
because the Planner re-registers both recurring reminders on every start.

> These live under `Planner:Orleans`, **not** under `Orleans`. The `Orleans` section belongs to
> Orleans itself, which binds it and reads `Orleans:Clustering` as the name of a registered
> clustering *provider* - putting the Planner's own value there makes the silo fail to build with
> `Could not find Clustering provider named 'Default'`.

## Claude accounts

Claude accounts are **not** configuration - they are managed on the *Claude Accounts* settings
page. Each account has a name, a plan (which selects its scheduling limits) and a Claude CLI
token. Create the token with:

```shell
claude setup-token
```

on a machine logged into the account, and paste it into the settings page. Work runs through the
regular Claude plan - not the API - by handing this token to the Claude CLI in the worker
container as `CLAUDE_CODE_OAUTH_TOKEN`.
