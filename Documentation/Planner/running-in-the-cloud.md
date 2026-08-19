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
- Crash dump capture is already configured in the image, but a dump only survives the container
  that wrote it if `/dumps` is a mounted volume, which the Deployment has to supply - see
  [Crash dumps](#crash-dumps).

## Crash dumps

A container that dies with exit 139 (SIGSEGV) and no log output leaves nothing to attach a stack
to. The Planner image is therefore built to write a dump on any native crash. The variables are
baked into `Source/Planner/Dockerfile`, so there is nothing to set in the Deployment:

| Variable | Value in the image | What it does |
| --- | --- | --- |
| `DOTNET_DbgEnableMiniDump` | `1` | Enables core dump generation. Off by default |
| `DOTNET_DbgMiniDumpType` | `2` (`Heap`) | Module and thread lists, all stacks, exception and handle information, and all memory except mapped module images |
| `DOTNET_DbgMiniDumpName` | `/dumps/planner.%p.%t.dmp` | Where the dump is written. `%p` is the process id and `%t` the crash time in seconds since the epoch, so successive crashes never overwrite each other |
| `DOTNET_EnableCrashReport` | `1` | Also writes a JSON report of the threads and stack frames of the crashing process, named after the dump with `.crashreport.json` appended |
| `DOTNET_CreateDumpDiagnostics` | `1` | Logs what `createdump` itself did to the crashing process's console, so a dump that fails to be written says why instead of failing silently |

`Heap` rather than `Full`: it keeps every stack and all memory except the mapped module images,
which are recoverable from the image anyway, while a `Full` dump is materially more likely to
exceed the pod's ephemeral-storage limit - and overrunning an `emptyDir` evicts the pod, deleting
the very dump that was being written. See the .NET
[Collect dumps on crash](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/collect-dumps-crash)
reference for the full set of variables.

### The dump is worthless without a volume

`/dumps` exists in the image because `createdump` opens the dump file but never creates the
directory it lives in. It is still in the container's **writable layer**, and a container that
exits 139 is discarded and replaced by a fresh one - so unless that path is a volume, the dump
dies with the container that wrote it. Add to the Planner Deployment:

```yaml
spec:
  template:
    spec:
      volumes:
        - name: dumps
          emptyDir:
            sizeLimit: 2Gi
      containers:
        - name: planner
          volumeMounts:
            - name: dumps
              mountPath: /dumps
```

An `emptyDir` lives as long as the **pod**, not the container. It survives the crash and restart
that a SIGSEGV self-heals from, which is exactly the case here, but a rollout, an eviction or a
node drain removes the pod and takes the dump with it. That is enough **provided someone collects
the dump before the next rollout**. Use a `PersistentVolumeClaim` instead if a dump has to outlive
the pod.

Two traps:

- Keep `sizeLimit` **below** the container's `resources.limits.ephemeral-storage`. A disk-backed
  `emptyDir` counts against that limit, so a `sizeLimit` above it lets the dump breach the pod's
  storage budget and get the pod evicted part-way through the write.
- Do **not** set `emptyDir.medium: Memory`. A tmpfs dump counts against the pod's memory limit, so
  a large enough dump OOM-kills the pod while writing the one artifact you needed.

### Getting a dump out

```bash
kubectl exec -n studio deploy/planner -- ls -lh /dumps
kubectl cp studio/<pod>:/dumps/planner.<pid>.<time>.dmp ./planner.dmp
```

The restarted container sees the dump too - the volume outlived the container that crashed, which
is the whole point of mounting it.

Record two more things in the same session: the image digest
(`kubectl get pod <pod> -o jsonpath='{.status.containerStatuses[0].imageID}'`) and `dotnet --info`
from inside the container. A `Heap` dump deliberately omits the module images, so analysis needs
the matching binaries, and both `cratis/planner:latest` and the `aspnet:10.0` base it builds on
float - the tag that produced this dump is not the tag you will pull next week.

Read the `.crashreport.json` first. It sits next to the dump, is a few kilobytes, and lists the
threads and their stack frames as JSON - usually enough on its own to settle whether the crash was
managed or native, which is what decides whether opening the dump in `dotnet-dump analyze` is
worth the effort.

## Operational access for alert investigations

[Alerts](./alerts.md) are investigated by an agent that needs to see the system it is investigating.
Mount that access as secrets rather than putting it in the manifest - the kubeconfig in particular
carries a cluster credential:

```yaml
env:
  - name: Planner__Alerts__WebhookSecret
    valueFrom: { secretKeyRef: { name: planner, key: alert-webhook-secret } }
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
