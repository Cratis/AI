---
name: cratis-arc-spring-data-kotlin
description: Use when wiring Spring Data JPA or MongoDB persistence, current-state injection or storage-backed observations in an Arc Kotlin application (Kotlin only). Not for Chronicle projections, C# EF Core or query transport alone.
license: MIT
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Use Spring Data with Arc in Kotlin

This is a Kotlin-only recipe.

For Java MongoDB observations, subscribe to the `Flow.Publisher` returned by `MongoObservations.observe(queries, TaskView.class, criteria)` instead of using Kotlin flow extensions.

Keep Spring Data responsible for persistence and Arc responsible for the
model-bound command/query pipeline. Repository injection alone does not isolate
tenants or turn a repository into an observable source.

## Install

Add `io.cratis:arc-spring-data-jpa:<version>` or
`io.cratis:arc-spring-data-mongodb:<version>`; both include the Arc Spring Boot
starter and corresponding Spring Data starter. Spring owns repository discovery,
datasource/entity manager, Mongo client and their standard configuration.

## Query a mapped read model

JPA example (requires the application's normal JPA entity/no-arg setup):

```kotlin
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import io.cratis.arc.artifacts.FromServices
import io.cratis.arc.artifacts.ReadModel
import jakarta.persistence.Entity
import jakarta.persistence.Id
import org.springframework.data.jpa.repository.JpaRepository

@Entity
@ReadModel
data class TaskView(@Id val id: String = "", val title: String = "") {
    companion object {
        @JvmStatic
        fun all(@FromServices tasks: TaskViewRepository): List<TaskView> = tasks.findAll()
    }
}

interface TaskViewRepository : JpaRepository<TaskView, String>
```

The same injection pattern works with `MongoRepository`, fragments or an
application query service.
Protect the query with the application's authorization policy; mapping does
not make it safe to expose anonymously.

A query can declare exact non-null Spring Data Commons `Pageable` and `Sort`.
KSP binds them from the captured `QueryRequest`, not thread-local request scope.
Such queries must return exact `org.springframework.data.domain.Page<T>`;
Arc normalizes it into `QueryPage<T>` before renderers, preserving pre-page
total count. Page size zero means unpaged; blank sort field means unsorted.
Do not confuse Spring Data `Page<T>` with a nonexistent Arc `Page<T>`.

## Current state in a command

Mapped `@ReadModel` types are owned by contextual
`CanResolveReadModelForCommand` providers. JPA claims `DECLARED` ownership;
MongoDB claims `FALLBACK`, so an explicit JPA/Chronicle/application owner wins.
Equal-strength claims fail startup. Registry-owned model parameters resolve
before ordinary services, using the generated command key and captured tenant.
Keys must already match the persistence identifier type, not need coercion.
Missing required rows or keys yield `dependencyUnavailable`; nullable Kotlin
parameters observe absence. Resolver failures remain exceptions.

## Stream storage snapshots

Mongo example excerpt inside a `TaskView` companion object (the type has an
`active` property and is Mongo-mapped):

```kotlin
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import io.cratis.arc.springdata.mongodb.MongoObservableQuery
import io.cratis.arc.springdata.mongodb.observe
import kotlinx.coroutines.flow.Flow
import org.springframework.data.mongodb.core.query.Criteria

@JvmStatic
fun active(@FromServices queries: MongoObservableQuery): Flow<List<TaskView>> =
    queries.observe<TaskView>(Criteria.where("active").`is`(true))
```

`observe`, `observeList`, `observeSingle`, `observeById`, `observeShared` are
extensions on Arc's `MongoObservableQuery` or `JpaObservableQuery`, not foreign
repositories or collections. Import the extensions from the store's package.
Flows are cold and close their subscription on cancellation. `observeShared`
explicitly shares one subscription and replays the latest complete snapshot.

MongoDB change streams require a replica set or sharded cluster; invalidations
cause a fresh filtered snapshot so rows that stop matching disappear. JPA
observations are **in-process only**: publish committed changes through
`DatabaseChangePublisher`. There is no silent polling or cross-process JPA
notification. A tenant label on a JPA notification is not storage isolation.

## Tenant-bound storage and concepts

Resolve/authenticate the tenant using `cratis-arc-identity-and-tenancy-kotlin`
first. Then select certified isolated stores:

- JPA: an application `JpaPersistenceUnitResolver` returns a `JpaPersistenceUnit`
  certified for the requested tenant/namespace and mapped type.
- Mongo: a `TenantAwareMongoOperationsResolver` returns `TenantMongoOperations`
  for the exact tenant. Unknown tenants throw; mismatched certificates fail,
  never fall back to a default database.
- `TenantContextMongoAccess.operations()` resolves the ambient tenant on **each
  call**, not at construction. Establish `withTenant` explicitly; the command
  pipeline does not create this ambient scope for you. The auto-configured access has no fallback tenant.

Plain injected repositories are not automatically routed by tenant. Native
collection access uses Arc's `NamingPolicy`, while Spring Data operations respect
`@Document`; choose deliberately. When changing a Chronicle projection’s collection name, verify that the projection writes to the same collection the Spring Data query reads.

Concept persistence needs store-specific converters: JPA attribute converters
(or embedded ids for composite identity), Mongo concrete scalar read/write pairs.
Do not persist a generic `ConceptAs` wrapper as an arbitrary object or assume a
JSON converter also handles BSON/JPA. Read the tagged `concepts-jpa.mdx` and
`concepts-mongodb.mdx` guides for the actual identifier type and converter registration.

## Transactions are explicit, thread-bound opt-ins

`cratis.arc.spring-data.jpa.command-transactions-enabled` and
`cratis.arc.spring-data.mongodb.command-transactions-enabled` default to false.
Enable only for a verified fixed store and identity-aligned transaction manager.
Dynamic tenant stores are not auto-enrolled. Even enabled, command persistence
must not suspend or switch threads: imperative Spring transactions are not
coroutine-safe. They commit only a successful final `CommandResult` and roll
back failures when completing on the opening thread.

There is **no distributed transaction** across JPA, MongoDB and Chronicle.
Chronicle completion follows local scopes, but a local store may already commit
before another store or Chronicle fails. Define reconciliation for partial or
indeterminate outcomes rather than claiming atomic cross-store success.

## Verify

- Run `./gradlew build`, pipeline specs via `cratis-arc-testing-kotlin`, and
  real-store tests for converters, paging counts and tenant isolation.
- Verify missing/unknown tenants cannot access the default store.
- Exercise Mongo snapshots against a real replica set; an in-memory emulator
  cannot prove change streams. Verify cancellation releases the cursor.
- For JPA, verify committed notifications, rollback suppression and the intended
  in-process boundary; test thread affinity before enabling transactions.

Query transport: [cratis-arc-expose-query](../cratis-arc-expose-query/references/kotlin.md). For the Chronicle JVM client, use [cratis-chronicle-select-client](../cratis-chronicle-select-client/SKILL.md); this skill covers Spring Data observation.

For an existing projection, read [how to change collection names safely](references/read-model-naming.md).
