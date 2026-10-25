<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Cluster membership, fencing and SQL schema ownership

Verified at Chronicle **v19.110.1**: `Documentation/hosting/configuration/`
(`clustering.md`, `storage.mdx`, `health-endpoint.md`),
`Source/Kernel/Core/Clustering/SingleWriterLeaseKeeper.cs`,
`Source/Kernel/Core/Configuration/{SchemaMode,SchemaAction,Features}.cs` and
`Source/Kernel/Server/KernelReadinessHealthCheck.cs`.

## Choose membership for the storage

From 19.98.0, PostgreSQL and SQL Server support multi-node membership with
`clustering.type = Sql`; MongoDB uses `MongoDB`. Every node must share the
cluster database, `clusterId`, `serviceId` and certificates. From 19.109.0,
SQL clustering with SQLite or a non-SQL provider fails at startup; it is not a
way to cluster SQLite. Sharing a database while using `Localhost` does not form
a cluster. Silo and gateway ports must remain reachable between nodes.

## Localhost single-writer lease

From 19.103.0, `Localhost` on persistent storage (MongoDB, PostgreSQL, SQL Server,
SQLite) takes the fixed `kernel` lease in the cluster database **before** Orleans
runtime startup. `InMemory` is process-local and takes no lease; MongoDB/Sql
membership do not use this guard. Different cluster/service ids are diagnostic,
not a way to bypass the fixed lease.

- `clustering.singleWriterLease.enabled` is automatic by default; disable it
  only with another proven single-writer mechanism.
- `ttl` defaults to 30 seconds (minimum 5); `acquireTimeout` defaults to 2 minutes.
  Zero timeout makes one attempt. A second node waits or refuses startup and
  stays unready; it does not become a safe second writer.
- Failed renewal marks health unhealthy and starts shutdown. Failure to confirm
  renewal within half the TTL hard-fences the process. Shutdown retains the
  lease while silo work drains; a crash successor waits for expiry. Do not
  delete a live lease to get another node started.
- Every contender must run 19.103.0+; an older binary does not take this lease.

## Least-privilege SQL deployments

From 19.109.0, `--migrate-only` (or
`Cratis__Chronicle__Storage__SchemaAction=MigrateAndExit`) applies SQL migrations
for the cluster, known stores/namespaces and jobs, then exits without serving.
Run it with the authorized schema identity before starting runtime-only nodes.

`Cratis__Chronicle__Storage__SchemaMode=Verify` performs no database/schema
creation or migrations. Missing schema at startup or a newly used namespace
fails with instructions to migrate. `Migrate` remains the default. Provision
new destinations before routing tenants to them; `createIfMissing=false` is
not equivalent to Verify and does not replace the migration step.

SQL schema-lock wait and recovered insert-collision metrics aid diagnosis;
readiness stays unhealthy until startup finishes. Do not restart a migrating
node using a readiness endpoint as liveness.

## Projection generations are not enabled by these releases

19.109.0–19.110.0 add guarded groundwork, not an instruction to enable it.
`Features.ProjectionGenerations` remains off by default. MongoDB generation
sink writes need majority transactions/fences, so startup refuses a standalone
MongoDB with the feature on. Materialization binding catalogs exist for
MongoDB and in-memory; SQL explicitly refuses that catalog. Generation-owned
collections refuse drop, rename or clear.

The per-store generation initializer is explicit and idempotent, records durable
receipts/blockers, and refuses adoption if it cannot prove exclusion; it is not
run automatically and does nothing with the feature disabled. Initialized stores
have a minimum kernel generation floor; older kernels and state reset are
refused. Do not recommend enabling the feature, deleting fences, or resetting
state to resolve an ordinary replay problem. Consult the tagged product sources
and accepted design before planning adoption.
