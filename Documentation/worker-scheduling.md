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

## Running-worker protection

Every worker pod template carries
`cluster-autoscaler.kubernetes.io/safe-to-evict: "false"`, alongside its existing
managed-by and network-policy labels. This asks Cluster Autoscaler not to evict the
pod during scale-down, independently of a PodDisruptionBudget. It does not prevent
explicit deletion, node failure, or other eviction mechanisms. See the
[Cluster Autoscaler scale-down exclusions](https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node).

The runtime retains its termination grace period, Job deadline, credential mount,
non-root execution, and resource declarations. No new configuration or API is required.
