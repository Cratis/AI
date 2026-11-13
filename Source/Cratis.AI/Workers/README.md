# Docker worker launches

Docker workers require an owner-trusted image using the worker entrypoint and UID/GID 1655.
**The caller must select images from an owner-trusted digest allow-list; the runtime does not enforce it.**
Image code starts before delivery and supplies the verification tools. This is not protection against
hostile images, entrypoints, or binaries. Kubernetes retains its existing mounted-Secret behavior.

The runtime starts with `CRATIS_WORKER_REQUIRE_SECRETS=true`. The entrypoint waits up to 30 seconds
for the Docker marker before starting an agent. Missing or insecure delivery fails closed.
The payload tmpfs is bounded to 16 MiB, owned by UID/GID 1655, mode `0700`. A separate 1 MiB readiness
tmpfs is root-owned, mode `0755`; UID 1655 cannot publish readiness there.

Before sending credentials, exec as UID/GID 1655 verifies both mounted filesystems with `stat -f`,
ownership/modes, and that the marker directory is not writable. Each payload file is streamed from
memory through exec stdin with private creation permissions and final mode `0400`. No secret bytes
enter the archive API, exec arguments, container-creation environment, or a dispatcher temporary file. Byte
counts guard against truncated input. Configuration names are single safe ASCII basenames and cannot
replace credentials, prompts, or readiness files. There is no writable-layer or host-file fallback.

Exec output is drained without retaining it, and hijacked streams are disposed. Inspection must reach
a terminal exit code; running/null states receive bounded readiness backoff under a 20-second delivery
deadline. All payload checks complete as UID/GID 1655 before a final root exec publishes the root-owned
`0444` marker by atomic rename. The entrypoint checks marker and directory ownership/modes too.
Publication is the commit point: cancellation or inspection failure after publication is an ambiguous
outcome, reported as failure followed by force-removal. It cannot promise the worker did not briefly
observe the committed marker. No additional payload verification follows publication.

Use `WorkerSecrets.Directory`, `FileName`, and `Path` for the payload; `DockerReadyDirectory`,
`DockerReadyPath`, and `DockerPendingReadyPath` identify Docker readiness. Kubernetes retains
`ReadyPath` and `PendingReadyPath` in the payload directory. The pending marker never releases the gate.
Job environment cannot override runtime-owned delivery, prompt, or cache names, case-insensitively.

Failed delivery force-removes the container with an independent cleanup deadline. A cleanup failure
requires operator removal and never reports success. Create and delivery diagnostics are withheld
because daemon or exec errors may contain sensitive values. Real-engine verification remains required:
mount landing, ownership/modes, layer cleanup, swap behavior, and hardening compatibility are not
established by mocked specs. All three harness Dockerfiles inherit the Ubuntu 24.04 .NET SDK base,
which supplies GNU coreutils (`stat -f`, `head`, `chmod`, `mv`) and findutils. Actual image availability
of those tools must also be checked end to end.

## Scoped cache access

Both runtimes use `WorkerJob.Cache` (`WorkerCacheAccess`) to select read-only
repository mirrors and one read-write `.agent-memory/<key>` directory. Null mounts
nothing, even with cache options configured. Keys are `v1-` plus 64 lowercase hex
characters; mirror paths are validated relative `.git` paths. The runtime owns
`DIRECT_MEMORY_PATH`, `DIRECT_REPOSITORY_CACHE` and the configured cache environment
name, filtering caller values case-insensitively. Invalid requests return
`WorkerLaunchOutcome.InvalidCache` before engine or cluster creation. Restricted
checkout and host-prepared jobs mount neither mirrors nor persistent memory.

For Kubernetes, provision a claim with read-write attachment (`ReadWriteMany` for
workers across nodes), list only existing mirrors, and pre-create the memory-key
directory writable by uid/gid 1655 using suitable ownership/group permissions.
Account for `fsGroup` and NFS permissions. Repository subPaths are read-only; only
the memory-key subPath is writable. This adds persistent writable memory where
the earlier whole-volume read-only mount could not provide it.

Docker omits missing mirrors, refuses linked or unsuitable descendants, and creates
a missing memory leaf with Unix mode `0770`. Existing ownership is unchanged;
operators must provide worker group access. Trusted writers must keep directories
stable through the check-to-bind window. Neither runtime mounts or deletes legacy
memory directories. Consumers must explicitly opt in when upgrading; the old
implicit whole-cache mount is not retained.

See [worker cache configuration](../../../Documentation/worker-scheduling.md#scoped-worker-cache-access)
for the complete path contract, environment behavior and provisioning requirements.

## Per-job resource limits

Set `WorkerJob.Limits` to cap Docker memory (bytes), CPU (nanocpus), and process count. Negative values
are rejected. A memory cap also sets the combined memory/swap cap to the same value. Memory swappiness
is zero. Missing limits or zero fields retain unlimited/default resource behavior. Bounded tmpfs is
not a guarantee against host swap or other host-level persistence. Kubernetes options are unchanged.

## Immutable images

Digest references such as `repo@sha256:<digest>` are pulled as complete references with no separate
tag. Tagged and untagged references retain their previous behavior; callers must enforce the trust policy.

## Optional Docker hardening

`Cratis:AI:ContainerRuntime:DockerHardeningEnabled` defaults to `false`. Opt in with `true` to disable
privileged mode, drop all capabilities, and set `no-new-privileges`; set `false` to opt out. Payload
writes and verification run as UID/GID 1655. The final marker publication exec runs as root, writing
only its root-owned mount and requiring no added capabilities. Prove compatibility with the actual
worker images end to end before enabling this. Kubernetes security configuration is unchanged.
