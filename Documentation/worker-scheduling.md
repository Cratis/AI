---
title: Kubernetes worker scheduling
description: Batch packing and autoscaler eviction protection for Kubernetes workers.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

`KubernetesWorkerRuntime` uses `WorkerRuntimeOptions.NodePoolWorkload` to select nodes
with the matching `workload` label and tolerate the matching `NoSchedule` taint.
An omitted, null, empty, or whitespace value leaves node placement unrestricted.

## Batch packing

Only the exact value `batch` enables packing. Worker pods prefer nodes hosting either:

- Pods labeled `actions-ephemeral-runner=True`.
- Pods labeled `app.kubernetes.io/managed-by=cratis-ai-agents`.

Each alternative is a separate preferred pod-affinity term with weight 100 and
`kubernetes.io/hostname` topology. An empty `namespaceSelector: {}` matches all
namespaces, so runners and workers do not need to share a namespace. This selector
behavior is stable in Kubernetes 1.24 and later; see
[Kubernetes inter-pod affinity namespace selection](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#namespace-selector).

Batch workers omit the soft topology-spread constraint that would counteract packing.
Other pools, including `compute` and `data`, retain the existing soft spread and gain
no packing affinity. Resource requests, limits, node selectors, and tolerations still
apply. Packing is a preference, not a requirement: the first worker can start without
an existing matching pod, and capacity can place subsequent workers elsewhere.

## Restricted checkout cache isolation

A shared repository cache exposes source from repositories beyond a job's checkout list,
even when mounted read-only. When `WorkerJob.EnvironmentVariables` contains
`DIRECT_REPOSITORY_CHECKOUTS`, both `KubernetesWorkerRuntime` and `DockerWorkerRuntime`
omit the configured repository-cache PVC or bind mount and its environment variable.
They also remove caller-supplied `DIRECT_REPOSITORY_CACHE` and the configured cache
variable. Presence of the checkout key is sufficient, including an empty contract;
invalid checkout contracts remain the entrypoint's responsibility to reject.

Ordinary jobs retain their existing cache mounts and environment. Restricted jobs
clone fresh instead. Upgrade the `Cratis.AI` runtime package as well as the harness
images: an entrypoint-only upgrade cannot remove a mount supplied by an older runtime.
This closes the shared-cache source-read path, not every possible credential, network,
or consumer-supplied file exposure.

## Running-worker protection

Every worker pod template carries
`cluster-autoscaler.kubernetes.io/safe-to-evict: "false"`, alongside its existing
managed-by and network-policy labels. This asks Cluster Autoscaler not to evict the
pod during scale-down, independently of a PodDisruptionBudget. It does not prevent
explicit deletion, node failure, or other eviction mechanisms. See the
[Cluster Autoscaler scale-down exclusions](https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node).

The runtime retains its termination grace period, Job deadline, credential mount,
non-root execution, and resource declarations. No new configuration or API is required.
