---
id: "0021"
title: Select worker cache directories explicitly per job
status: proposed
stage: none
class: contract
reversibility: costly
applies-to:
  - Source/Cratis.AI/Workers/**
  - Source/AgentHarnesses/entrypoint.sh
  - Source/WorkerCacheFixture/**
supersedes: "0011"
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# 0021 - Scoped worker cache mounts

## Status

Proposed on November 13, 2026. Implementation proceeds under the explicit request
for Cratis/AI#1152. Named-decider attribution remains pending; this record does
not claim acceptance. It replaces only the cache-mount behavior associated with
[decision 0011](0011-worker-runtime-engine-moves-into-cratis-ai.md), not the runtime
extraction or its configuration names.

## Context

Repository mirrors and persistent agent memory share a configured cache. Worker
jobs need an explicit filesystem scope independent of the entrypoint's environment
conventions. Memory also needs a writable key directory: the previous Kubernetes
whole-volume read-only mount could not provide persistent writable memory.

## Decision

A job selects its cache through `WorkerJob.Cache`, a typed `WorkerCacheAccess`
containing an opaque memory key and relative repository mirror paths. The runtime
validates the request before creating resources, mounts only those mirrors
read-only and the key directory read-write, and sets the cache and memory paths
itself. Null mounts nothing; restricted checkout and host-prepared modes retain
no cache mounts. Invalid requests return `InvalidCache`. The runtime never mounts
the cache root or legacy memory directories and never migrates or deletes them.

## Options considered

- Per-directory Docker binds and Kubernetes `subPath` mounts retain shared mirrors
  without copying them for each job. One configured PVC is attached read-write;
  read-only flags apply to repository mounts, while memory alone is writable.
- Environment-only selection leaves the filesystem scope to the entrypoint rather
  than the runtime, so it is not the chosen boundary.
- Owner/name pairs couple the contract to one mirror layout. Relative paths support
  multi-segment layouts, with a conservative character set and no nested mounts.
- Copying mirrors into a per-job volume adds startup I/O and another cache-reading
  container. A separate PVC per identity adds provisioning overhead. Neither is
  needed for the selected per-directory contract.

## Default if unanswered

This record remains proposed without named human acceptance. The requested scoped
implementation is retained; the record's status does not authorize reverting to
implicit whole-volume mounts. Consumers must coordinate their package upgrade
and explicit cache requests, or jobs run without persistent cache access.

## Timeline and scope

The contract applies from adoption of this runtime until a replacement decision.
It covers cache validation, mounts, runtime-owned environment, missing-mirror
fallback and provisioning requirements for Docker and Kubernetes. Consumers own
identity-to-key derivation, repository authorization, directory preparation and
legacy backup/retirement. Cluster provisioning, NFS ownership changes, memory
concurrency and migration tooling are outside this change.

## Verification

**Done when:** valid jobs mount only selected read-only mirrors and one writable
memory-key directory; null and restricted requests mount no cache; malformed or
unsuitable Docker paths refuse launch before runtime contact; own-key writes
persist without changing repository or legacy memory files.

**Verify by:** run the worker runtime specifications for both target frameworks,
the entrypoint fixtures and `WorkerCacheFixture` using generated runtime mounts.
Check actual Kubernetes subPath behavior and uid/gid 1655 NFS writes on the target
cluster separately; Docker translation of the pod mounts does not prove them.

## Consequences

Consumers that relied on implicit whole-volume mounting must now set `Cache`.
Keys are `v1-` plus 64 lowercase hexadecimal characters. Mirror paths are bounded,
relative `.git` paths with nonempty, non-hidden ASCII segments; duplicates collapse
and nested paths are rejected. The consumer controls key derivation and mirror
layout. Runtime-owned environment values cannot be replaced by job values.

Kubernetes requires read-write claim attachment (`ReadWriteMany` for workers across
nodes), existing mirrors and a pre-created memory directory writable by uid/gid
1655 using suitable ownership/group permissions and NFS configuration. Empty mirror
directories use the network clone fallback. Docker omits missing mirrors, creates
a missing memory leaf with Unix mode `0770`, and refuses linked descendants without
changing existing ownership. Its configured root is trusted and may be a symlink;
trusted cache writers must keep descendants stable during the check-to-bind window.

The complete operational contract is in
[worker cache configuration](../worker-scheduling.md#scoped-worker-cache-access).
