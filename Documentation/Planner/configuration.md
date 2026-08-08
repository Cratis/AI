# Configuring the Planner

All configuration lives in `appsettings.json` and can be overridden with environment variables
(`__` as the section separator, e.g. `Planner__GitHub__Token`).

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
| `Token` | *(empty)* | Token for the GitHub API - repository read, issues read/write, pull request merge, organization member read. Also handed to workers as `GITHUB_TOKEN` |
| `WebhookSecret` | *(empty)* | The secret GitHub signs webhook deliveries with. When empty, signature validation is skipped - local development only |

Point an organization webhook at `https://<planner-host>/webhooks/github` with the *Issues* and
*Repositories* events, content type `application/json`, and the same secret.

## Worker - `Planner:Worker`

| Key | Default | Purpose |
| --- | --- | --- |
| `Image` | `cratis/planner-worker:latest` | The worker container image (built from `Source/Claude`) |
| `CallbackBaseUrl` | `http://host.docker.internal:5200` | The base URL workers report back to - must be reachable *from inside a worker container* |

## Scheduling - `Planner:Scheduling`

| Key | Default | Purpose |
| --- | --- | --- |
| `MaxConcurrentWorkPerAccount` | `1` | How many units of work may run concurrently per account |
| `DefaultModel` | `sonnet` | The model for implementation work when nothing suggested one |
| `InvestigationModel` | `opus` | The model used for investigations |
| `Limits:<Plan>:SessionsPerFiveHours` | 1 / 3 / 6 | Sessions per rolling five-hour window for Pro / Max5x / Max20x |
| `Limits:<Plan>:SessionsPerWeek` | 40 / 120 / 240 | Sessions per rolling week for Pro / Max5x / Max20x |

The limits are deliberately conservative approximations of the Claude plan boundaries - tune them
to your accounts' real experience.

## Container runtime - `ContainerRuntime`

| Key | Default | Purpose |
| --- | --- | --- |
| `Type` | `Auto` | `Auto`, `Docker` or `Kubernetes`. `Auto` picks Kubernetes when running in a cluster, otherwise the local Docker engine |
| `DockerEndpoint` | *(auto)* | Explicit Docker daemon endpoint; defaults to `DOCKER_HOST` / the platform socket |
| `KubernetesNamespace` | `default` | The namespace worker jobs are created in |

## Orleans - `Orleans`

| Key | Default | Purpose |
| --- | --- | --- |
| `Enabled` | `true` | Co-hosts the Orleans silo (scheduler + consolidation grains) |
| `Clustering` | `Localhost` | `Localhost` (single instance, in-memory reminders) or `MongoDB` (durable clustering and reminders for multiple instances) |

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
