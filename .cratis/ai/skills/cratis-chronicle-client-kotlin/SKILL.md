---
name: cratis-chronicle-client-kotlin
description: Talk to a Chronicle server from a Kotlin or Java application with the io.cratis:chronicle client - connection strings, ChronicleClient and the Spring Boot starter, @EventType classes, suspending append, reactors and reducers dispatched by first-parameter type, model-bound and declarative projections, variants (@VariantOf/@EntersOn/@GlobalFor or variantOf()/entersOn()) for an entity with mutually exclusive lifecycle shapes, classpath artifact discovery, and the blocking API Java uses. Use when building a JVM application that appends to or observes a Chronicle event store. Do not use for the .NET, TypeScript, or Elixir clients, and do not use for Chronicle kernel or Arc work.
license: MIT
---

# The Chronicle client for Kotlin and Java

`io.cratis:chronicle` is a **standalone client SDK**. Your application is an
ordinary JVM application that happens to talk to a Chronicle server over gRPC.
There is no framework to inherit from and no application architecture imposed:
you construct a client, ask it for an event store, and append or observe.

## Verified product sources

This skill was written against `Chronicle.Kotlin` at tag `v4.0.0` (commit
`63ff629`) and re-verified at **`v5.1.0`**: every class, function, option and
Spring bean this skill names exists there. The `4→5` major is the Chronicle 17/18
wire migration (gRPC request/response shapes and `ensureSuccess` result
envelopes — internal to the client); `5.0.0` also adds a `ChronicleCommandRejected`
exception for a rejected server-side command. The `file:line` citations below
were taken at `v4.0.0` and may have shifted.

| Artifact | Version | Verified from |
| --- | --- | --- |
| `io.cratis:chronicle` | `5.1.0` | `Chronicle.Kotlin` at tag `v5.1.0` |
| `io.cratis:chronicle-spring-boot-starter` | `5.1.0` | same tag, `Integrations/SpringBoot` |
| `io.cratis:chronicle-testing` | `5.1.0` | same tag, `Testing` |
| `io.cratis:chronicle-contracts` | `18.2.0` | `Source/build.gradle.kts` (`chronicleContractsVersion`) |

All three artifacts are published to Maven Central under `io.cratis`
(`Source/build.gradle.kts:54`, `Testing/build.gradle.kts:32`,
`Integrations/SpringBoot/build.gradle.kts:48`). The JVM toolchain is **17**
(`Source/build.gradle.kts:43`).

> **Do not copy a version number out of the repository's README or docs.** At
> `v4.0.0` the README still says `2.1.1` (`README.md:186`) and the documentation
> says `2.1.2` (`Documentation/get-started/index.md:24`). The version comes from
> a Gradle property injected at release time — `Source/build.gradle.kts:8` reads
> `providers.gradleProperty("version")` and defaults to `0.0.0-SNAPSHOT` — so
> the checked-in source never carries the real number. Take it from Maven
> Central.

> **The client and the kernel version independently.** Client `5.1.0` is built
> against `chronicle-contracts` `18.2.0` (the `4.x` line was built against
> `16.44.1` and does not speak the 17/18 wire shapes); the Chronicle server is
> on `18.x`. Confirm the client/server pair you intend to run is
> supported before relying on it — do not infer compatibility from the fact that
> both are "latest".

## Common pitfalls

| Pitfall | Why it bites |
| --- | --- |
| Naming a reactor method after the event | The name is ignored; **the first parameter's type** is the subscription (`EventHandlerMethod.kt:61-74`) |
| Two `@EventType` classes sharing a simple name | The id defaults to the simple name, so they collide on the wire (`EventTypesService.kt:67`) |
| Shipping the default connection string to production | `skipTlsValidation` defaults to **true**; certificate validation is off (`ChronicleConnectionString.kt:28`) |
| Copying a version from the README or docs | Both are stale at `v4.0.0`; the real version comes from the release, not the source |
| Expecting `getEventStore` to suspend | It does not — the client already connected in its constructor (`ChronicleClient.kt:12`) |
| Expecting `awaitRegistration()` to mean "registered" | It completes in a `finally`, so it also returns after a failed pass (`ArtifactRegistrations.kt:47-57`) |
| Expecting a registration failure to throw | Failures are printed to `System.err`, not raised (`EventStore.kt:244`) |
| Expecting read model reactors to be discovered | `IReadModelReactor` is absent from the scan and from `IEventStore`; construct `ReadModelReactors(...)` yourself |
| Leaving the default classpath scan on in a large app | Use `withArtifactsFrom(...)` or `artifact-packages` to narrow it (`ChronicleOptions.kt:58`) |
| Expecting WebFlux support from the starter | The web auto-configuration is `SERVLET`-only (`ChronicleWebAutoConfiguration.kt:29`) |
| Exiting `main` after an append | Reactors and reducers stop with the process; the stream is live |
| Passing a `KProperty1` as `@VariantOf`'s `key` | The annotation form always takes a plain string; only the declarative `variantOf(...)` builder accepts a property reference |
| A `@GlobalFor` mapping targeting a property one variant lacks | `GlobalHandlerPropertyNotOnVariant` at registration, not a silently skipped mapping |

## Two ways in — pick one

| You are building | Use | Artifact |
| --- | --- | --- |
| A plain Kotlin/Java application, a CLI, a worker | `ChronicleClient` directly | `io.cratis:chronicle` |
| A Spring Boot application | the starter, and inject the beans | `io.cratis:chronicle-spring-boot-starter` |

The starter is a wrapper over the same client. Everything below about event
types, appending, and observers is identical either way; only the wiring differs.

## Connecting

### Plain Kotlin

```kotlin
import io.cratis.chronicle.ChronicleClient
import io.cratis.chronicle.ChronicleOptions
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    val options = ChronicleOptions.development()
    val client = ChronicleClient(options)
    try {
        val store = client.getEventStore("<EventStoreName>")
        // ... use store ...
    } finally {
        client.dispose()
    }
}
```

`IChronicleClient` is small and complete —
`Source/src/main/kotlin/io/cratis/chronicle/IChronicleClient.kt`:

| Member | Line | Note |
| --- | --- | --- |
| `fun getEventStore(name: String, namespace: String = EventStoreNamespaceName.default.value): EventStore` | `:17-20` | **not** suspending; returns the concrete `EventStore` |
| `suspend fun getEventStores(): List<String>` | `:27` | asks the kernel |
| `fun evictEventStores()` | `:36` | drops the local cache, keeps the client |
| `fun dispose()` | `:39` | `IChronicleClient : AutoCloseable`, `close()` delegates to it (`:41`) |

**The client connects in its constructor.** `ChronicleClient.kt:12` is
`ChronicleConnection(options.connectionString).also { it.connect() }` — there is
no separate `connect()` step to call, and constructing the client is the
connecting act. Event stores are cached per `"$name/$namespace"`
(`ChronicleClient.kt:21`), so repeated `getEventStore` calls return the same
instance.

The default namespace is the literal `"Default"` —
`EventStoreNamespaceName.kt:13`.

### Options

`ChronicleOptions` is a `data class` with `@JvmOverloads`
(`ChronicleOptions.kt:35`):

| Property | Default | Line |
| --- | --- | --- |
| `connectionString` | required | `:36` |
| `programIdentifier` | `"Unknown"` | `:37` |
| `defaultSinkTypeId` | `CHRONICLE_SINK_TYPE` env var, else `WellKnownSinkTypes.MONGODB` | `:38` |
| `autoDiscoverAndRegister` | `true` | `:39` |
| `artifacts` | `ClientArtifacts.default` (scans the classpath) | `:40` |
| `artifactActivator` | `ArtifactActivator` | `:41` |
| `openTelemetry` | `null` (uses the globally registered one) | `:42` |

Two `@JvmStatic` factories: `ChronicleOptions.fromConnectionString(String)`
(`:69`) and `ChronicleOptions.development()` (`:78`). Two instance helpers:
`withoutAutoRegistration()` (`:48`) and `withArtifactsFrom(vararg packages)`
(`:58`) — the second is worth using in any large application, because the
default scan walks the whole classpath.

### The connection string

`ChronicleConnectionString.kt` documents the grammar at `:14-18`:

```
chronicle://<host>[:<port>][,<host>[:<port>]...][?<options>]
chronicle://<username>:<password>@<host>[:<port>][,...][?<options>]
chronicle+srv://<host>[:<port>][?<options>]
```

Default port is `35000` (`:39`). Recognized query keys, lowercased at parse time
(`:111-115`): `disabletls`, `skiptlsvalidation`, `apikey`, `loadbalancer`,
`srvnameserver`. `ChronicleConnectionString.parse(String)` is on the companion
(`:63`), and `ChronicleConnectionString.DEVELOPMENT` (`:51`) points at
`localhost:35000` with the `chronicle-dev-client` / `chronicle-dev-secret`
credentials (`:42-43`).

> **TLS is on, certificate validation is off, by default.** `disableTls = false`
> but `skipTlsValidation = true` — `ChronicleConnectionString.kt:27-28`, and the
> credential selection at `:180-181` installs an `InsecureTrustManager` in that
> case. That default exists because a development kernel serves a self-signed
> certificate. **A production connection string must carry
> `?skipTlsValidation=false`**, which is the only way to get chain validation
> against the platform trust store (`:174-176`).

### Spring Boot

The starter binds `cratis.chronicle.*` (minimum: `event-store`) and exposes the `IChronicleClient`, `IEventStore` and `Chronicle` beans; its web auto-configuration is servlet-only.

Read [references/spring-boot.md](references/spring-boot.md) when wiring or configuring the Spring Boot starter (properties, namespace resolution, injected beans, WebFlux).

## Defining event types

```kotlin
import io.cratis.chronicle.events.EventType

/** <What happened, in the past tense.> */
@EventType
data class <EventName>(
    val <property>: <Type> = <default>
)
```

`io.cratis.chronicle.events.EventType` — `events/EventType.kt:15-19`:

```kotlin
annotation class EventType(
    val id: String = "",
    val generation: Int = 1,
    val tombstone: Boolean = false
)
```

**The id defaults to the class's *simple* name, not its fully qualified name** —
`events/EventTypesService.kt:67` resolves `ann.id.ifEmpty { cls.simpleName!! }`.
Two event classes with the same simple name in different packages therefore
collide on the wire. Give one an explicit `id`.

The house shape is a Kotlin `data class` with defaulted properties
(`Samples/Kotlin/SpringBoot/.../Events.kt:9-14`) or a Java `record`
(`Samples/Java/SpringBoot/.../EmployeeHired.java:9-10`). Property-level
annotations that travel with the event: `@io.cratis.chronicle.keys.Key`,
`@io.cratis.chronicle.compliance.Pii`, `@io.cratis.chronicle.Subject`,
`@io.cratis.chronicle.schemas.JsonSchemaType`.

Evolving a schema is `IEventTypeMigration<TTarget, TSource>` with `upcast` and
`downcast` — `events/migrations/IEventTypeMigration.kt:18-37`. Migrations
register in the same call as event types
(`artifacts/ArtifactRegistrations.kt:63`).

## Appending

Everything that touches the kernel suspends. `IEventSequence.kt`:

```kotlin
suspend fun append(eventSourceId: String, event: Any, options: AppendOptions? = null): AppendResult          // :37
suspend fun appendMany(eventSourceId: String, events: List<Any>, options: AppendOptions? = null): List<AppendResult>  // :47
suspend fun appendMany(                                                                                       // :65
    events: List<EventForEventSourceId>,
    concurrencyScopes: Map<String, ConcurrencyScope> = emptyMap(),
    correlationId: UUID? = null
): List<AppendResult>
```

```kotlin
val result = store.eventLog.append("<event-source-id>", <EventName>(<value>))
if (!result.isSuccess) {
    // result.constraintViolations, result.concurrencyViolation, result.errors
}
```

- **The event source id is a plain `String`** at every call site
  (`IEventSequence.kt:37`). Typed alternatives taking `ConceptAs<String>` exist
  as extension functions in `io.cratis.chronicle.concepts`
  (`concepts/EventSourceIdConcepts.kt`).
- `AppendResult` carries `sequenceNumber`, `constraintViolations`, `errors`,
  `isSuccess`, `concurrencyViolation` — `eventSequences/AppendResult.kt:18-33`.
  It also carries `sequenceNumberValue: Long` (`:32`) purely so Java can read
  the number, because `EventSequenceNumber` is a `@JvmInline value class` whose
  getter Java cannot name.
- The three-argument `appendMany(List<EventForEventSourceId>, ...)` is the only
  overload that commits atomically **across** event sources.
- Reach for the second overload's `EventForEventSourceId` when events in one
  batch must go to different streams — the single-source overloads cannot
  express that.

`AppendOptions` (`eventSequences/AppendOptions.kt:41-51`, `@JvmOverloads`)
carries `correlationId`, `concurrencyScope`, `eventSourceType`,
`eventStreamType`, `eventStreamId`, `subject`, `tags`, `occurred`, `causation`.

A unit of work spans several appends:

```kotlin
val unitOfWork = store.unitOfWorkManager.begin()
store.eventLog.transactional.append("<id>", <EventName>(<value>))
store.eventLog.transactional.appendMany("<id>", listOf(<OtherEvent>()))
unitOfWork.commit()
```

`transactional` appends return `Unit`, not an `AppendResult`; the results are on
the unit of work (`transactions/IUnitOfWork.kt:23-101`).

## Observing

### Handlers are found by their first parameter's type

This is the single most important convention in this client, and it is not the
method name. `observation/EventHandlerMethod.kt:61-74` reads a function as a
handler only when **parameter index 1 — the first real parameter — is a class
annotated with `@EventType`**. The method name is irrelevant. A handler may be
`suspend` or plain; both are invoked through `callSuspend`.

```kotlin
import io.cratis.chronicle.events.EventContext
import io.cratis.chronicle.observation.Reactor

@Reactor
class <ReactorName>(private val <dependency>: <Dependency>) {
    fun <anyMethodName>(event: <EventName>, context: EventContext): <SideEffectEvent> {
        <dependency>.<doSomething>(event.<property>)
        return <SideEffectEvent>(<property> = context.eventSourceId)
    }
}
```

That shape is the shipped sample verbatim
(`Samples/Kotlin/SpringBoot/.../WelcomePackageReactor.kt:16-22`).

**A returned event is appended as a side effect.** `null`, `Unit`, and any value
whose type is not annotated `@EventType` are ignored; a single event, an
`EventForEventSourceId`, or a `List` mixing both is appended, defaulting to the
triggering event source — `observation/ReactorSideEffects.kt:26-39`, `:48-59`.
This is how a reactor appends without ever touching the event log.

`EventContext` is a data class with `sequenceNumber: Long`, `eventSourceId`,
`eventType`, `occurred`, `correlationId`, `causedBy`, `eventSourceType`,
`eventStreamType`, `eventStreamId`, `eventStore`, `namespace`, `causation`,
`tags`, `hash`, `observationState` — `events/EventContext.kt:31-47`.

### The annotations

| Annotation | Arguments | Source |
| --- | --- | --- |
| `@Reactor` | `id = ""`, `eventSequence = ""` | `observation/Reactor.kt:15` |
| `@Reducer` | `id = ""`, `eventSequence = ""`, `isActive = true` | `observation/Reducer.kt:17` |
| `@ReadModel` | `id = ""`, `displayName = ""` | `readModels/ReadModel.kt:19` |
| `@Projection` | `id = ""`, `eventSequence = ""` — optional | `projections/Projection.kt:22` |
| `@Constraint` | `id = ""` | `constraints/Constraint.kt:13` |
| `@Seeder` | none | `seeding/Seeder.kt:11` |

Handler-level: `@Replay`, `@OnceOnly`. Observer filtering: `@Tag`/`@Tags`,
`@FilterEventsByTag`/`@FilterEventsByTags`, `@EventSequence`,
`@EventSourceType`, `@EventStreamType`.

A reducer's handler may be `(event)`, `(event, state)`, or
`(event, state, context)` — the three shapes accepted by the dispatcher and by
`ReadModelScenario` (`Testing/.../ReadModelScenario.kt:146-150`). **Reducers run
client-side**: the kernel streams events and the handler is invoked in your
process (`observation/ReducersService.kt:119-140`).

### Read models and model-bound projections

Read models are queried through `store.readModels`
(`readModels/IReadModelsService.kt`): `getInstanceByKey(readModelClass, key): T?`
(`:11`), `getInstances(readModelClass, eventCount)` (`:20`),
`getSnapshotsById` (`:29`), and `watch(readModelClass): Flow<ReadModelChangeset<T>>`
(`:37`, which is **not** suspending — it hands back a `Flow`).

A model-bound projection puts the projection on the read model with `@FromEvent`
(`projections/FromEvent.kt:17`) and `@SetFrom`
(`projections/SetFrom.kt:22`); the full family also includes `SetValue`,
`SetFromContext`, `AddFrom`, `SubtractFrom`, `Increment`, `Decrement`, `Count`,
`Join`, `RemovedWith`, `RemovedWithJoin`, `ChildrenFrom`, `ClearWith`,
`FromAll`, `FromEvery`, `FromEventSourceId`, `CountFromAll`, `IncrementFromAll`,
`DecrementFromAll`, `Nested`, `NoAutoMap`, `NoAutoMapProperties`,
`NotRewindable`. The declarative
alternative is a class implementing `IProjectionFor<TReadModel>`.

### Variants — mutually exclusive read models for one entity's lifecycle

Variants let several read models share one identity and be mutually exclusive; each variant must declare an `@EntersOn`/`entersOn(...)` event or registration throws `VariantMustDeclareEntersOnEvent`. Requires `io.cratis:chronicle` `6.3.0` or later.

Read [references/variants.md](references/variants.md) when an entity changes shape over its lifecycle and you need `@VariantOf`, `@EntersOn`, `@GlobalFor` or the declarative `variantOf`/`entersOn` builder.

## Discovery and registration

Artifacts are found by a classpath scan and registered in a fixed order, re-run on every reconnect.

Read [references/discovery-and-registration.md](references/discovery-and-registration.md) when you need the scan rules, registration order, reconnect behavior, or `registerAll()` with `autoDiscoverAndRegister = false`.

## Java

Java code starts at `BlockingChronicleClient.connect(...)`, not the raw `ChronicleClient` plus `*JavaBridge` statics; in Spring Boot, inject the `Chronicle` bean.

Read [references/java-api.md](references/java-api.md) when writing Java against the client (blocking surface, conformance suite, README's older bridge route).

## Connection lifecycle

Keepalive is two-way and silence, not an error, is how the connection dies; your process must stay alive for reactors and reducers to keep receiving.

Read [references/connection-lifecycle.md](references/connection-lifecycle.md) when diagnosing disconnects, reconnect/backoff behavior, keepalive timeouts or shutdown.

## Testing

`io.cratis:chronicle-testing` runs in-process with no kernel and no Docker:
`EventScenario` (`Testing/.../EventScenario.kt:35`) and
`ReadModelScenario<TReadModel>` (`Testing/.../ReadModelScenario.kt:47`), which
folds a reducer through the same handler-shape rules as production
(`ReadModelScenario.kt:139-150`). Its scope is small — appends and reducer folds
only; there is no in-process reactor, projection, or constraint scenario
(`Testing/api/Testing.api` is 57 lines).

## Verify

- The dependency resolves from Maven Central and the version is the one you
  intended — not a number copied from a README.
- A connect against the target kernel succeeds, and the client/server version
  pair is one you confirmed rather than assumed.
- A production connection string sets `skipTlsValidation=false`.
- Every `@EventType` class has a unique simple name, or an explicit `id`.
- Every reactor and reducer handler's **first parameter** is an `@EventType`
  class.
- `awaitRegistration()` is followed by a check that registration actually
  succeeded, not treated as proof on its own.
- Every variant group has at least one `@EntersOn`/`entersOn(...)` per variant,
  and every `@GlobalFor` member exists on every variant it targets.
- The build is clean and the specifications pass against the verified artifact
  version.
