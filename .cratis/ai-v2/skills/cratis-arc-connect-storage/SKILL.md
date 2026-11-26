---
name: cratis-arc-connect-storage
description: Use when wiring EF Core, MongoDB or Neo4j persistence into an Arc-only slice, or migrating its database schema. Not for Chronicle materialization (cratis-chronicle-project-view).
---

# Bind storage without introducing an event store

1. Identify the provider already owned by the application, its scoped service, migration owner and tenant-to-storage mapping. Reject missing tenant selection. **Done:** an isolated database or schema is available and no production target is a fallback. Do not add Chronicle solely to separate commands and queries.
2. Inject the provider's typed dependency into the handler/query method. For EF register `WithEntityFrameworkCore` on the Arc builder and bind the application's context to its provider and connection. Inject that scoped context, save, then reload using a fresh context so the change tracker cannot satisfy the assertion. Apply pending migrations only to the disposable fixture first. With MongoDB use the tenant's typed collection; observation needs a change-stream-capable deployment. With Neo4j keep the session bound to the intended database and dispose it after the operation. **Done:** a second request reloads the committed value at the expected key.
3. Seed the same key with a different name in another tenant and repeat the read after the write. **Done:** tenant B's value is unchanged and the migration preserves existing fixture rows. If reload fails, compare the selected database, serializer mapping and acknowledged write before changing the CQRS contract. Hand an actual projection requirement to `cratis-chronicle-project-view` rather than pretending a provider save emits a fact.
