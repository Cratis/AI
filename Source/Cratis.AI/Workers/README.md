# Docker worker launches

Docker workers require an image using the worker entrypoint and UID 1655. The runtime starts the
container with `CRATIS_WORKER_REQUIRE_SECRETS=true`; the entrypoint waits up to 30 seconds for
`WorkerSecrets.ReadyFileName` before starting any agent. Missing or insecure delivery fails closed.
Kubernetes does not set this switch and keeps its existing mounted-Secret behavior.

The runtime verifies the live secrets mount is tmpfs, owned by UID 1655 with mode 0700, before
sending credentials. Credentials, prompts and configuration are streamed from memory as regular
files owned by UID/GID 1655 with mode 0400. Archive ownership is preserved and checked as the worker.
Configuration names must be single ASCII filenames and cannot replace the credentials, prompt or
readiness files. The ready marker is published separately, only after delivery and permission checks.
There is no writable-layer or host-file fallback.

Callers should use `WorkerSecrets.Directory`, `FileName`, `Path`, `ReadyFileName`, `ReadyPath`,
`PendingReadyFileName` and `PendingReadyPath` rather than duplicating names. `PathVariableName`
and `RequiredVariableName` name the entrypoint switches. The pending marker is not readiness;
only the final marker releases the gate.

Failed delivery force-removes the container (including its tmpfs), even when the launch was cancelled.
A cleanup failure is reported explicitly and requires operator removal of the container; launch never
reports success in that case. Engine diagnostics from credential delivery are withheld from exceptions
and logs because they may include payloads. Real-engine verification remains an end-to-end concern.

## Per-job resource limits

Set `WorkerJob.Limits` to a `WorkerLimits` value to cap Docker memory (bytes), CPU (nanocpus),
and process count. A memory cap also sets the total memory-plus-swap cap to the same value,
disabling swap for the job. Missing limits or zero fields leave that resource unlimited.
Kubernetes continues to use its existing resource options.

## Immutable images

Digest references such as `repo@sha256:<digest>` are pulled as complete references with no separate
tag. Tagged and untagged image references retain their previous behavior.
