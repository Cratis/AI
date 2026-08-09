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

## Orleans - `Planner:Orleans`

| Key | Default | Purpose |
| --- | --- | --- |
| `Enabled` | `true` | Co-hosts the Orleans silo (scheduler + consolidation grains) |
| `Clustering` | `Localhost` | `Localhost` (single instance, in-memory reminders) or `MongoDB` (durable clustering and reminders for multiple instances) |

An unrecognized `Clustering` value fails startup rather than quietly falling
back to `Localhost`.

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
