<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Worker console streaming

`IWorkerRuntime.StreamLogs(session, cancellationToken)` returns console lines as an asynchronous stream.

For `KubernetesWorkerRuntime`:

- A Job may exist before its Pod or container starts. Streaming waits for the worker container
  instead of reporting an empty console during this readiness window.
- A terminated container remains readable while its Pod exists, whether it succeeded or failed.
- A deleted Job with no Pod, or a terminal Job without a readable container, ends the stream.
- Cancellation stops both readiness waiting and log streaming.
- Kubernetes failures other than a confirmed missing Job propagate to the caller.

The runtime does not archive logs. Your application must consume and persist the stream independently
of any open browser connection, and retain that archive after Kubernetes deletes the Pod.
