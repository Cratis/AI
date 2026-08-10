# Running the Planner in the cloud

The Planner ships as two images, published by the `planner-publish` workflow:

| Image | Contents |
| --- | --- |
| `cratis/planner` | The application - backend serving the built frontend from `wwwroot` on port 8080 |
| `cratis/planner-worker` | The worker the Planner schedules - Claude CLI, .NET 10 SDK, Node + Yarn, GitHub CLI |

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

## Webhooks

Expose the Planner behind an ingress with TLS before connecting the GitHub App - see
[Setting up the GitHub App](./github-app-setup.md). The App's manifest configures its own webhook
(`https://<planner-host>/webhooks/github`, secret generated alongside the App's credentials) when
registered through the **Connect GitHub App** flow - there is no separate organization webhook to
register by hand. The repository event auto-tracks new repositories created in the organization;
the daily consolidation backfills anything delivered while the Planner was down.

## Publishing

`planner-publish` runs on every push to `main` touching `Source/**` (and on demand with an
explicit version). It builds the frontend and backend natively, bakes `cratis/planner`, builds
`cratis/planner-worker` from `Source/Claude`, and pushes both to Docker Hub using the
`DOCKER_USERNAME` / `DOCKER_PASSWORD` repository secrets.
