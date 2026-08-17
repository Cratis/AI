# Running the Planner in the cloud

The Planner ships as two images, published by the `planner-publish` workflow:

| Image | Contents |
| --- | --- |
| `cratis/planner` | The application - backend serving the built frontend from `wwwroot` on port 8080 |
| `cratis/planner-worker` | The worker the Planner schedules - Claude CLI, .NET 10 SDK, Node + Yarn, and the GitHub, Docker and Kubernetes CLIs |

## Infrastructure

- **MongoDB** as a replica set (Atlas or self-hosted). Chronicle requires transactions and change
  streams; a standalone `mongod` will not work.
- **Chronicle** - the `cratis/chronicle` image with
  `Cratis__Chronicle__Storage__Type=MongoDB` and
  `Cratis__Chronicle__Storage__ConnectionDetails=<connection string>` - see the Chronicle hosting
  documentation for TLS, authentication and scale-out.

## Kubernetes

Run the Planner as a Deployment with the environment:

```yaml
env:
  - name: Cratis__Chronicle__ConnectionString
    value: chronicle://chronicle:35000
  - name: Cratis__MongoDB__Server
    value: mongodb://mongodb:27017
  - name: Planner__GitHubApp__AppId
    valueFrom: { secretKeyRef: { name: planner, key: github-app-id } }
  - name: Planner__GitHubApp__Slug
    valueFrom: { secretKeyRef: { name: planner, key: github-app-slug } }
  - name: Planner__GitHubApp__PrivateKeyPem
    valueFrom: { secretKeyRef: { name: planner, key: github-app-private-key } }
  - name: Planner__GitHubApp__WebhookSecret
    valueFrom: { secretKeyRef: { name: planner, key: github-app-webhook-secret } }
  - name: Planner__Security__ForwardedUserHeader
    value: X-Auth-Request-User
  - name: Planner__Worker__Image
    value: cratis/planner-worker:latest
  - name: Planner__Worker__CallbackBaseUrl
    value: http://planner:8080
  - name: ContainerRuntime__Type
    value: Kubernetes
  - name: ContainerRuntime__KubernetesNamespace
    value: planner-workers
  - name: Planner__Orleans__Clustering
    value: MongoDB
```

- `ContainerRuntime:Type` `Auto` also detects Kubernetes when running in-cluster; setting it
  explicitly documents intent. Workers become Kubernetes **Jobs** (`backoffLimit: 0`, cleaned up
  an hour after finishing) in the configured namespace.
- The Planner's service account needs RBAC to create jobs in the worker namespace:

  ```yaml
  rules:
    - apiGroups: ["batch"]
      resources: ["jobs"]
      verbs: ["create"]
  ```

- `Planner:Worker:CallbackBaseUrl` must resolve from inside worker pods to the Planner service. It is
  an in-cluster address and is used for worker callbacks only - never for anything a browser has to
  reach. The GitHub App manifest, for instance, derives its URLs from the request the operator's
  browser arrived on (honoring `X-Forwarded-Proto` / `X-Forwarded-Host`), so the ingress must forward
  those headers.
- With `Planner:Orleans:Clustering=MongoDB`, cluster membership is durable in the `planner-orleans`
  database, so multiple replicas form one cluster. Reminders are in-memory in both modes and are
  re-registered on every start (see [Configuration](./configuration.md#orleans---plannerorleans)).
  The key deliberately sits under `Planner:`, not under `Orleans:` - that section belongs to Orleans,
  which reads `Orleans:Clustering` as the name of a clustering provider it must resolve.
- Set `DOTNET_DbgEnableMiniDump=1` (and `DOTNET_DbgMiniDumpType=4`, with `DOTNET_DbgMiniDumpName`
  pointing at a mounted path) when investigating a silent native crash. A container that dies with
  exit 139 and no log output leaves nothing to attach a stack to otherwise; the dump is the only
  artifact that turns one into a diagnosable failure.

## Operational access for alert investigations

[Alerts](./alerts.md) are investigated by an agent that needs to see the system it is investigating.
Mount that access as secrets rather than putting it in the manifest - the kubeconfig in particular
carries a cluster credential:

```yaml
env:
  - name: Planner__Alerts__WebhookSecret
    valueFrom: { secretKeyRef: { name: planner, key: alert-webhook-secret } }
  # Required - an empty secret rejects every delivery, so the alert webhook stays shut without it.
  - name: Planner__Operations__Kubeconfig
    valueFrom: { secretKeyRef: { name: planner, key: operations-kubeconfig } }
  - name: Planner__Operations__KubernetesNamespace
    value: studio
  - name: Planner__Operations__LokiUrl
    value: http://loki.studio.svc.cluster.local:3100
  - name: Planner__Operations__Repositories__0
    value: Cratis/Studio
  - name: Planner__Operations__IssueOwner
    value: Cratis
  - name: Planner__Operations__IssueRepository
    value: Studio
```

Note the `__0` index - a list bound from environment variables is one variable per element.

Give the kubeconfig its **own** service account, scoped to reading pods, nodes, events and logs and
restarting workloads in the namespaces an investigation covers. Do not reuse the Planner's own
credential: that one can create jobs, and an alert investigation has no business doing so.

## The security boundary

The Planner schedules autonomous agents that hold a GitHub push token and, on alert investigations,
whatever operational access you configured - up to a production kubeconfig. Treat every surface it
exposes accordingly.

### What the Planner enforces itself

| Surface | Enforced by |
| --- | --- |
| `POST /api/work/{id}/callback` | A per-work bearer token, generated when the work is dispatched, injected into the container as `PLANNER_CALLBACK_TOKEN`, and verified in constant time. Rejects with 401 when absent or wrong. The token is retired when the work completes, fails or is stopped |
| `POST /api/work/{id}/input`, `GET /api/work/{id}/log` | An authenticated operator (see below). Rejects with 401 otherwise |
| `POST /webhooks/github`, `POST /webhooks/alerts` | HMAC-SHA256 over the raw body against the configured secret, compared in constant time. **An unconfigured secret rejects every delivery** - both fail closed |
| `SetAccountToken`, `RegisterAccount`, `RemoveAccount`, `AcceptPullRequest`, `StopWork`, `ScheduleAdHocWork`, `ScheduleAlertInvestigation` | An authenticated operator, through Arc's `[Authorize]`. Rejects with 403 otherwise |

Operator identity comes from the ingress. Configure `Planner:Security:ForwardedUserHeader` with the
header your proxy records the authenticated login in (`X-Forwarded-User`, or `X-Auth-Request-User`
for oauth2-proxy):

```yaml
env:
  - name: Planner__Security__ForwardedUserHeader
    value: X-Auth-Request-User
```

**Until you set it, no request is ever recognized as an operator** - steering, log streaming and
every command in the table above are refused, and the Planner says so as a warning at startup. That
is deliberate: an unconfigured deployment is closed, not open.

### What the ingress must enforce

The Planner cannot enforce any of this from inside. If the ingress does not, the listed consequence
is real.

| The ingress must | If it does not |
| --- | --- |
| **Overwrite `Planner:Security:ForwardedUserHeader` on every inbound request**, never pass a client-supplied copy through | Any caller sets the header themselves and becomes any operator they name. This is the single most important item on this list |
| **Authenticate every route** except `/webhooks/github`, `/webhooks/alerts` and `/health` | Everything below applies |
| **Deny or authenticate `/api`** | Every Arc command and query without `[Authorize]` is open: the whole issue, repository, pull request, group and alert surface can be read and rewritten anonymously |
| **Deny or authenticate `/.cratis`, `/openapi`, `/scalar`** | The query streams and the full API description are readable anonymously |
| **Authenticate `/github-app/created` and `/github-app/installed`** | The GitHub App registration return path is reachable by anyone |
| **Terminate TLS** | The forwarded identity header, the worker callback token and every credential in transit are readable on the wire |
| **Forward `X-Forwarded-Proto` / `X-Forwarded-Host`** | The GitHub App manifest derives its URLs from the request the operator's browser arrived on and will build unreachable ones |
| **Keep the worker network path internal** | `Planner:Worker:CallbackBaseUrl` is an in-cluster address; workers must not have to traverse the public ingress to report |

### What is still open by design

These carry no `[Authorize]` because automation executes them, and they are therefore only as
protected as the ingress in front of `/api`:

- every read query (issues, work, repositories, pull requests, accounts, usage, alerts),
- `ScheduleWork`, `StartWork`, `CompleteWork`, `FailWork` and the issue/pull-request mirror
  commands, which the scheduler, the reactors and the webhook translators execute,
- `ChangeAccountPlan`, and the issue-editing commands (`ChangeIssueStatus`, `SetIssuePrompt`,
  grouping, reordering).

Marking an issue **Ready for development** is what starts an agent, so an unauthenticated `/api` is
enough to make the Planner run agents on your repositories even with everything above in place.
**Authenticating `/api` at the ingress is not optional.**

### Rotating and revoking

- Worker callback tokens rotate on every dispatch and retire on every terminal event; nothing to do.
- Webhook secrets are deployment configuration - rotate them at the sender and in the secret together.
- Removing an operator is done at the identity provider in front of the proxy; the Planner holds no
  user records of its own.

## Webhooks

Expose the Planner behind an ingress with TLS before connecting the GitHub App - see
[Setting up the GitHub App](./github-app-setup.md). The App's manifest configures its own webhook
(`https://<planner-host>/webhooks/github`, secret generated alongside the App's credentials) when
registered through the **Connect GitHub App** flow - there is no separate organization webhook to
register by hand. The repository event auto-tracks new repositories created in the organization;
the daily consolidation backfills anything delivered while the Planner was down.

The alert webhook (`https://<planner-host>/webhooks/alerts`) is a second, unrelated endpoint - point
your production watchdog at it and give it the same secret you configured above.

## Publishing

`planner-publish` runs on every push to `main` touching `Source/**` (and on demand with an
explicit version). It builds the frontend and backend natively, bakes `cratis/planner`, builds
`cratis/planner-worker` from `Source/Claude`, and pushes both to Docker Hub using the
`DOCKER_USERNAME` / `DOCKER_PASSWORD` repository secrets.
