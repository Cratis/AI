# Find the store the kernel actually opened

Start with the intended cluster, provider, logical storage identity and namespace. Resolve the kernel's own settings in order: built-in defaults, `chronicle.json` beside the kernel executable, then `Cratis__Chronicle__…` environment overrides. That is the kernel loader's order, not a rule about arbitrary .NET host configuration. The application client is configured separately. Its `DefaultSinkTypeId` selects a read-model sink type; it does not select the kernel's event database.

If a store looks empty after credential rotation, check secret mounts, file permissions, provider resolution and logical storage identity before looking for missing events. Do not derive identity from the rotating credential, fall back to another database, or report a temporary lookup failure as “not found.” Retry a transient lookup against the intended store. For a Workbench sign-in problem, first establish that its listener is reachable; a refused connection is not a rejected password. For a slow subscriber, check whether an individual request timed out or the observer is actually quarantined.

## Preserve ownership during repair or removal

Choose a clustering mode that fits the deployment. Where one writer holds a lease, verify that the old writer can no longer write after losing ownership. Do not clear a fence to make startup succeed. Treat conflicting SQL schema or index ownership as a migration: identify the owner and expected schema before changing either. An append returning `ConstraintIndexUnavailable` during an index rebuild wrote nothing. Wait for the index and retry the unchanged append, not one with its constraint removed. This is not a business collision.

Namespace removal is destructive. Obtain separate approval for the exact store and non-default namespace, stop its clients, and inventory provider-owned data and independent copies first. `IEventStore.RemoveNamespace` cannot remove the default namespace; verify the implementation supports removal. Do not substitute a database reset if it does not. A successful removal is not evidence of erasure from backups, external sinks or exports.
