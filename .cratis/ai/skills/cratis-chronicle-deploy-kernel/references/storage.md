# Find the store the kernel actually opened

Start with the intended cluster, provider, logical storage identity and namespace. Resolve the kernel's own settings in order: built-in defaults, `chronicle.json` beside the kernel executable, then `Cratis__Chronicle__…` environment overrides. That is the kernel loader's order, not a rule about arbitrary .NET host configuration. The application client is configured separately. Its `DefaultSinkTypeId` selects a read-model sink type; it does not select the kernel's event database. For a per-model destination, see “Choose a sink” in the C# reference of `cratis-chronicle-project-view`.

If a store looks empty after credential rotation, check secret mounts, file permissions, provider resolution and logical storage identity before looking for missing events. Do not derive identity from the rotating credential, fall back to another database, or report a temporary lookup failure as “not found.” Retry a transient lookup against the intended store. For a Workbench sign-in problem, first establish that its listener is reachable; a refused connection is not a rejected password. For a slow subscriber, check whether an individual request timed out or the observer is actually quarantined.

## Preserve ownership during repair or removal

Where one writer holds a lease, verify that the old writer can no longer write after losing ownership. Do not clear a fence to make startup succeed. Treat conflicting SQL schema or index ownership as a migration: identify the owner and expected schema before changing either. An append returning `ConstraintIndexUnavailable` during an index rebuild wrote nothing. Wait for the index and retry the unchanged append, not one with its constraint removed. This is not a business collision.

Namespace removal is destructive. Obtain separate approval for the exact store and non-default namespace, stop its clients, and inventory provider-owned data and independent copies first. `IEventStore.RemoveNamespace` cannot remove the default namespace; verify the implementation supports removal. Do not substitute a database reset if it does not. A successful removal is not evidence of erasure from backups, external sinks or exports.

MongoDB drops the namespace database; SQL and in-memory providers retain namespace data. Application-owned read-model databases are not dropped and require separately authorized cleanup. A reconnecting client releases the removed namespace when the kernel confirms it is absent; explicitly using it again can recreate it. Stop or reroute writers. Verify in a disposable namespace with a matching provider and client across restart and reconnect, and report retained data separately from removed registration. Check the kernel is at least 19.73.0 for removal, 19.75.1 for reminder cleanup and 19.76.1 for re-subscription recovery, and the .NET client is at least 19.77.1 for reconnect handling.

## Choose cluster membership

For multiple active nodes, use `clustering.type: Sql` with PostgreSQL or SQL Server (Chronicle 19.105.0+), or `MongoDB` with MongoDB storage. Share the cluster database, `clusterId`, `serviceId` and compatible certificates across nodes. Make silo ports reachable between nodes and enabled gateway ports reachable by trusted Orleans clients. `Sql` with SQLite or non-SQL storage fails at startup; sharing a database under `Localhost` does not form a cluster.

## Separate SQL schema and runtime identities

On Chronicle 19.109.0 or later, run `--migrate-only` (`Cratis__Chronicle__Storage__SchemaAction=MigrateAndExit`) with the schema-owner identity before starting runtime nodes. Pre-provision new destinations with repeatable `--event-store` and `--namespace` flags before routing writes; supplied namespaces apply to each explicitly supplied store. Probe with the runtime identity using `--verify-schema` (`VerifyAndExit`) without applying changes. Run normal replicas with `Cratis__Chronicle__Storage__SchemaMode=Verify` and without a schema action. Verify prevents versioned migrations but is not a blanket DDL prohibition for dynamically shaped tables.

Require exit code `0` from both actions before rolling out. SQL action exit codes: `0` success, `2` schema not current, `3` schema lock timeout, `4` invalid configuration or forbidden database creation, `1` unexpected failure. In-memory actions are no-ops; a MongoDB index check on kernels that support it is not a SQL schema check.

## Cut over to a dedicated compliance key store

Set `compliance.encryption.migrateFromDefaultStorage` before enabling the dedicated store. Chronicle then serves existing keys from the default store if necessary and migrates them on read. Without it, empty released fields can look like successful erasure. In an isolated rehearsal, release a synthetic subject before and after the switch and confirm it still decrypts. Then erase that subject and confirm release withholds the protected value. Keep the fallback until you verify that the dedicated store holds every key, including those for subjects never read during the rollout. Retiring the old store is a separate cleanup decision.

For Azure Key Vault, grant the Chronicle identity purge permission and use a vault without purge protection. Every key revision must be purged, not just soft-deleted. Treat a refused or incomplete purge as unfinished erasure.
