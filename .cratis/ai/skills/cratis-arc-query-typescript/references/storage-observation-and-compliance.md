<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Storage observation and protected raw reads

Verified at `Cratis/Arc.TypeScript` **v0.57.2** (source preview, not on npm):
`Source/Drizzle/DrizzleOptions.ts`, package exports and observation code,
`Source/MongoDB/MongoReadModelsOptions.ts`, `Source/Chronicle/releaseRawDocument.ts`,
`Documentation/sql/observing-tables.md`, `observing-postgresql.md`, and
`Documentation/chronicle/compliance.md`.

## Drizzle live queries

`rxjs ^7.8.2` is a **required peer** of `@cratis/arc.drizzle`, even with
observation disabled. Starting an observation without opting in throws; it never
silently returns a stream that will not update.

- In-process: `withDrizzle({ ..., observation: DrizzleObservation.InProcess })`.
  Writers call `DrizzleHandle.notifyChanged(tableOrType)` for a registered table
  object/model, in the current tenant. Only announced writes in this process
  invalidate reads. Inside commands, notifications coalesce until that tenant's
  outermost command finishes (success **or failure**). Transactions owned outside
  Arc are not covered; announce only after their commit. Background writes
  announce immediately, so call after commit.
- Cross-process PostgreSQL (experimental): use observation options
  `{ mode: DrizzleObservation.PostgreSQLNotify, listener }`. Install the SQL from
  `postgresqlChangeTrigger(table, { schema })` in an application-owned drizzle-kit
  custom migration, not at runtime. `nodePostgresListener(new Client(...))` wraps
  a new, unconnected, dedicated `pg.Client`; route both listener and query pool
  to the same primary database. Aliased tables, views, partitions, inherited and
  temporary tables are rejected. Recovery reconnects with bounded backoff,
  revalidates triggers, then forces fresh snapshots; there is no in-process
  fallback and no durable replay of outage history.

`DrizzleReadModels.observe(filter?)` / `observeById(key)` return RxJS sources
with `current()`. The former fails on `maxPageSize` overflow rather than
truncating; the latter emits null for absence/deletion. Use these for model-bound
observable queries. `observePage` requires low-level `defineObservableQuery` and
has **no generated proxy support**. Count and page are eventually consistent,
not one atomic snapshot. Release subscriptions/scopes to release listeners.

## MongoDB compliance release

With Chronicle registered, decoded **exact** protected read-model instances are
released before query encoding. For raw `MongoReadModels` documents, pass
`readModel: PersonView`, with that type registered with `withChronicle`, and
optionally `subjectFor(document)`. Default subject is stored `__subject`, then a
string/numeric `_id`. Typed reads reject partial MongoDB projections.

Release is fail-closed. The query/emission fails for a mismatched subject or
tenant, nonempty `__subjects` (per-property subjects), undeclared fields,
non-JSON BSON values, missing schemas, or a failed/incomplete release. Date
values are accepted; BSON ObjectId/Binary/Decimal128 payload fields are not.
Return typed documents directly, in arrays, or in **`queryPage`**. Nesting one
inside another response shape — including `MongoReadModels.page()`'s `MongoPage`
— fails; read multi-subject models through `ChronicleReadModels` instead.

Untyped MongoReadModels, unmarked driver documents, copies that lose their
marking, and `MongoDBWatcher.changes()` are still served **as stored ciphertext**.
Do not assume any raw query was decrypted merely because Chronicle is installed.
Protected reducer-watch removals whose payload the SDK cannot release carry an
empty model instance rather than that unreleased payload.

Release is not authorization. Filter by the verified caller separately. See
`cratis-chronicle-compliance` for subject/erasure principles, but use these
TypeScript APIs rather than its .NET code shapes.
