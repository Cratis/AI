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
  - name: Planner__GitHub__Token
    valueFrom: { secretKeyRef: { name: planner, key: github-token } }
  - name: Planner__GitHub__WebhookSecret
    valueFrom: { secretKeyRef: { name: planner, key: webhook-secret } }
  - name: Planner__Worker__Image
    value: cratis/planner-worker:latest
  - name: Planner__Worker__CallbackBaseUrl
    value: http://planner:8080
  - name: ContainerRuntime__Type
    value: Kubernetes
  - name: ContainerRuntime__KubernetesNamespace
    value: planner-workers
  - name: Orleans__Clustering
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

- `Planner:Worker:CallbackBaseUrl` must resolve from inside worker pods to the Planner service.
- With `Orleans:Clustering=MongoDB`, clustering and reminders are durable in the
  `planner-orleans` database, so multiple replicas form one cluster and the scheduler/consolidation
  grains keep running across restarts. A single replica can stay on `Localhost` clustering.

## Webhooks

Expose the Planner behind an ingress with TLS and register an **organization webhook** on GitHub:

- Payload URL: `https://<planner-host>/webhooks/github`
- Content type: `application/json`
- Secret: the value of `Planner:GitHub:WebhookSecret`
- Events: *Issues* and *Repositories*

The repository event auto-tracks new repositories created in the organization; the daily
consolidation backfills anything delivered while the Planner was down.

## Publishing

`planner-publish` runs on every push to `main` touching `Source/**` (and on demand with an
explicit version). It builds the frontend and backend natively, bakes `cratis/planner`, builds
`cratis/planner-worker` from `Source/Claude`, and pushes both to Docker Hub using the
`DOCKER_USERNAME` / `DOCKER_PASSWORD` repository secrets.
