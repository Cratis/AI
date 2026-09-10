# Kotlin Style and Conventions

This file governs how Kotlin is written in Arc.Kotlin: file headers and layout, visibility and the
published surface, KDoc, naming, immutability, type modeling, null handling, `suspend` and
structured concurrency, collections, exceptions, and what `allWarningsAsErrors` means in practice.
Kotlin is the implementation language for every module in this repository — `Source`,
`CodeGeneration/KSP`, `GradlePlugin`, all six `Integrations/**`, and `Testing` are Kotlin source
sets. Java is a first-class *consumer*, never the implementation language, so a Kotlin decision that
reads well here but compiles into an awkward JVM signature is still wrong: see
[kotlin-java-interop.md](./kotlin-java-interop.md), which outranks this file wherever a style
preference and a Java-visible signature disagree.

## License header

Every `.kt` and `.kts` file starts with exactly these two lines, followed by a blank line:

```kotlin
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
```

File-level annotations go *after* the header and *before* the `package` line, separated by blank
lines — `Source/src/main/kotlin/io/cratis/arc/commands/CompletionStageAwait.kt`:

```kotlin
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

@file:JvmName("CompletionStages")

package io.cratis.arc.commands
```

## Files and packages

- Source lives under `<Module>/src/main/kotlin/io/cratis/arc/...`. The directory path always matches
  the package. `Source` owns `io.cratis.arc.*`; integrations own `io.cratis.arc.<area>.*`
  (`io.cratis.arc.springboot`, `io.cratis.arc.chronicle`, `io.cratis.arc.springdata.jpa`, …).
- **Default: one public top-level declaration per file, named after it.** `CommandPipeline.kt`,
  `TenantId.kt`, `QueryResult.kt`.
- The one sanctioned deviation is a *cohesive family* of small related declarations, in a file named
  for the family in the plural: `java/QueryAdapters.kt`, `java/CommandAdapters.kt`,
  `tenancy/StandardTenantIdResolvers.kt`, `results/ResultExtensions.kt`,
  `commands/CommandValueFactories.kt`, `queries/ReadModelForCommandResolvers.kt`. Do not use this to
  park unrelated types together.
- Private helpers used by exactly one file stay in that file as `private` top-level declarations
  (`private object TenantHost` in `tenancy/SubdomainTenantIdResolver.kt`) rather than becoming new
  files.
- This is a **repository convention**, not a compiler rule.

## Visibility and the published surface

- **Write `public` explicitly on every public declaration.** The Kotlin `explicitApi()` mode is
  *not* enabled in this build — the modifier is a house convention that makes an intentional export
  visible in review. Grep any file under `Source/src/main/kotlin` and you will find it on every
  class, interface, function, property, and companion member.
- Use `internal` for anything the module needs but consumers must not see — `internal class
  ConceptValidation`, `internal constructor` on `AsyncCommandPipeline`, `internal fun
  attachExecutionToken`. `internal` is invisible to Java's `-Werror` build *and* absent from the
  `.api` baseline, which is the machine gate.
- The **framework contract** is the checked-in `.api` baseline (`Source/api/Source.api` and the
  per-integration files), enforced by `./gradlew apiCheck`. Any change to a public signature must
  land with the regenerated baseline in the same commit. See [gradle.md](./gradle.md).
- Prefer an `internal constructor` plus a public factory over a public constructor when the type is
  only meaningfully created by the framework — `AsyncCommandPipeline`, `AsyncQueryPipeline`,
  `AsyncAuthentication`, and `EventsWithConcurrencyScopes` all do this.

## KDoc

- **Every public declaration carries KDoc**, including companion members, enum entries, and
  properties declared in a primary constructor. One sentence, in the third person, describing
  behavior — not restating the name.
- Constructor properties are documented inline, above the parameter
  (`Source/src/main/kotlin/io/cratis/arc/commands/CommandContext.kt`):

  ```kotlin
  public class CommandContext @JvmOverloads constructor(
      /** Correlation identifier for the execution. */
      public val correlationId: UUID,
      /** Command instance being executed. */
      public val command: Any,
  ```

- Use a multi-paragraph KDoc when the type carries a contract a caller can get wrong — ordering,
  precedence, wire behavior, or an interop reason. `ConceptAs`, `ArcEnum`, `CommandResult`,
  `TenantIdResolver`, and `CommandExecutionToken` are the models.
- Reference other declarations with brackets (`[BlockingAuthorizationPolicy]`,
  `[io.cratis.arc.artifacts.CommandKey]`) so the link survives.
- American English everywhere: behavior, serialize, initialize, color, canceled/cancellation.

## Naming

- Types: `PascalCase`. Functions, properties, parameters: `lowerCamelCase`.
- `const val` and `@JvmField` constants: `SCREAMING_SNAKE_CASE` — `DEFAULT_HEADER_NAME`,
  `TenantId.NOT_SET`, `ObservableQuerySubscriptionRevision.MAX_VALUE`.
- **Enum entries are `SCREAMING_SNAKE_CASE` by default** — `QueryTransportType.REQUEST_RESPONSE`,
  `ArcHttpStatus.INTERNAL_SERVER_ERROR`, `ReadModelForCommandOwnership.DECLARED`.
  The exception is an enum serialized *by name* onto the Arc wire, which keeps the wire spelling:
  `ValidationResultSeverity` (`Unknown`, `Information`, `Warning`, `Error`) and
  `ObservableQueryHubMessageType` (`Subscribe`, `QueryResult`, `Ping`) are the two cases, and both
  exist because a JavaScript or .NET peer already reads those names.
- Adapter families use a fixed prefix pair so the intent is obvious at the call site:
  `Blocking*`/`Async*` for the Java-facing SPI, `*Adapter` for the class that bridges it to the
  suspending contract — `BlockingCommandValidator` → `BlockingCommandValidatorAdapter`.
- Avoid abbreviations. `configure`, not `cfg`; `repository`, not `repo`.

## Immutability

Immutability is the default and it is enforced by construction, not by documentation.

- Public state is `val`. `var` appears only in private, synchronized, or coroutine-local scope.
- **Defensively copy every collection that crosses a constructor.** The house idioms are
  `java.util.List.copyOf(...)`, `java.util.Set.copyOf(...)`,
  `Collections.unmodifiableMap(LinkedHashMap(source))`, and
  `Collections.unmodifiableList(ArrayList(source))` — chosen deliberately over `toList()` because
  they hand Java callers a genuinely unmodifiable view. From
  `Source/src/main/kotlin/io/cratis/arc/results/CommandResult.kt`:

  ```kotlin
  public val validationResults: List<ValidationResult> = java.util.List.copyOf(validationResults)
  ```

- Accept the widest reasonable input type and narrow on store: take `Iterable<T>` or
  `Collection<T>` in the constructor, expose `List<T>`.
- Validate in `init` with `require` (argument) or `check` (state), with a message that says what the
  caller should do — `CommandContext`, `PagingInfo`, and `QueryContext` all do this.

## Type modeling

- **`data class` when value equality is part of the contract** — `TenantId`, `TenantName`, `Tenant`,
  `TenancyOptions`. Remember that `copy`, `componentN`, `equals`, `hashCode`, and `toString` all
  become published API the moment the class is public.
- **Plain `class` when equality is not part of the contract**, even for immutable value carriers:
  `CommandResult`, `QueryResult`, `ValidationResult`, `PagingInfo`, and `CommandContext` are plain
  classes with `val` properties. Prefer this. A `data class` you did not need is a `copy` overload
  and a set of `componentN` accessors you must now keep binary-compatible forever.
- **Do not introduce `@JvmInline value class` in a published surface.** There is not one in this
  repository, and `Integrations/Chronicle` explicitly works around Chronicle's own inline class
  rather than re-exposing it. See [kotlin-java-interop.md](./kotlin-java-interop.md) for why.
- **`sealed interface` for closed result unions**, with nested `class` implementations:

  ```kotlin
  public sealed interface ObservableQueryOpenResult {
      /** Query filters or performer creation rejected the subscription. */
      public class Failure(public val result: QueryResult<*>) : ObservableQueryOpenResult

      /** A controlled cold stream of query results. */
      public class Stream(public val results: Flow<QueryResult<*>>) : ObservableQueryOpenResult
  }
  ```

  Consume them with an exhaustive `when` and no `else` branch, so adding a case becomes a compile
  error. `AuthenticationOutcome`, `CommandExecutionToken`, and `AsyncObservableQueryOpenResult`
  follow the same shape.
- **`fun interface` for a single-method SPI a consumer implements** — `TenantIdResolver`,
  `CommandKeyProvider`, `BlockingAuthorizationPolicy`, `AsyncTenantsProvider`. This gives Kotlin a
  lambda and Java a lambda in one declaration.
- Types are final unless extension is a designed feature. `FixedTenantIdResolver` and
  `QueryStringTenantIdResolver` are `open` precisely because `DevelopmentTenantIdResolver` and
  `QueryTenantIdResolver` are declared subclasses of them.

## Nullability

- `null` is a modeled answer, never a shrug. When a function returns `null`, KDoc says what `null`
  means: *"Returns the resolved tenant, or `null` when this resolver has no answer."*
- **Never use `!!`.** Use `requireNotNull`, `checkNotNull`, `?:` with a fail-closed branch, or
  `takeIf`/`let`. The one bare `!!` in `Source` main is `exception.cause!!` inside an explicit
  `exception.cause != null` guard.
- Prefer safe-call chains and `?.let(::Ctor)` over defensive `if` ladders:

  ```kotlin
  private fun String?.toTenantIdOrNull(): TenantId? = this?.takeIf(String::isNotBlank)?.let(::TenantId)
  ```

- At a Java-facing boundary, treat every incoming reference as possibly null even when the Kotlin
  type is non-null — Kotlin's generated parameter null checks are what stop it, and they throw
  `NullPointerException`, not a validation result. Where a `null` from Java is a *usage* error the
  pipeline should report, validate it explicitly.

## Coroutines and structured concurrency

- **The suspending contract is the primary SPI.** `CommandPipeline.execute`, `QueryPipeline.perform`,
  `QueryPerformer.perform`, `CommandValidator.validate`, and `AuthorizationPolicy.evaluate` are all
  `suspend`. Java-facing variants are separate adapter types, never a second overload on the same
  interface.
- **Never use `ThreadLocal` for state a coroutine can observe.** This is an `AGENTS.md` rule and the
  repository has zero occurrences. Carry state either as an explicit parameter (`CommandContext`,
  `QueryContext`, `TenantResolutionContext`) or as a `CoroutineContext` element —
  `Source/src/main/kotlin/io/cratis/arc/commands/CommandExecutionToken.kt`:

  ```kotlin
  internal class CommandExecutionContext(
      val token: CommandExecutionToken
  ) : AbstractCoroutineContextElement(Key) {
      companion object Key : CoroutineContext.Key<CommandExecutionContext>
  }
  ```

  installed with `withContext(CommandExecutionContext(token)) { ... }` in `DefaultCommandPipeline`.
- **Cancellation is cooperative, and `CancellationException` must never be swallowed.** The house
  pattern is to catch and rethrow it *before* the general handler, so a cancelled command is not
  reported as a failed command:

  ```kotlin
  } catch (exception: CancellationException) {
      throw exception
  } catch (exception: Exception) {
      return ObservableQueryOpenResult.Failure(QueryResult.exception<Any?>(options.correlationId, exception))
  }
  ```

- Cleanup that must still run after cancellation goes in `withContext(NonCancellable) { ... }`. The
  kotlinx.coroutines reference describes `NonCancellable` as "designed for `withContext` function to
  prevent cancellation of code blocks that need to be executed without cancellation";
  `DefaultCommandPipeline` uses exactly that to complete execution scopes in reverse order, each
  under its own `withTimeout`.
- **Do not create a `CoroutineScope` a caller cannot see or close.** A long-lived scope is either
  owned by an `AutoCloseable` (`JavaAsyncScope`, `BlockingCommandScenario`) or supplied by the host.
  Owned scopes are always `CoroutineScope(SupervisorJob() + dispatcher)` and are cancelled in
  `close()`.
- `runBlocking` is allowed **only** in a declared blocking bridge for Java or test setup —
  `UsersProviderAggregator.provideBlocking`, `TenantsProviderAggregator.provideBlocking`,
  `BlockingCommandScenario`, `BlockingQueryScenario`, `ChronicleCommandScenario`. It must never
  appear on a path a request coroutine can reach.
- Bridge a `CompletionStage` into a coroutine with the repository's own
  `io.cratis.arc.commands.await`, which uses `suspendCancellableCoroutine` and cancels the future via
  `invokeOnCancellation`. Do not add a second await helper.
- Blocking I/O inside a suspending function is wrapped in `withContext(Dispatchers.IO)`; see
  `Integrations/SpringDataMongo/src/main/kotlin/io/cratis/arc/springdata/mongodb/MongoObservation.kt`.

## Collections and sequences

- Return read-only `List`, `Set`, `Map` from public API. `MutableList` never appears in a published
  signature.
- Build with `mutableListOf` / `linkedMapOf` locally, then copy on the way out.
- Preserve declaration order deliberately and say so in KDoc — `LinkedHashMap` and
  `putIfAbsent`/`getOrPut` are used throughout (`TenantsProviderAggregator`,
  `TenantResolutionContext`) because order *is* the contract.
- Use `asSequence()` when a chain short-circuits over a possibly long input, as in
  `CompositeTenantIdResolver`:

  ```kotlin
  override fun resolve(context: TenantResolutionContext): TenantId? = resolvers.asSequence()
      .mapNotNull { it.resolve(context) }
      .firstOrNull { it.value().isNotBlank() }
  ```

  For short, already-materialized lists, plain collection operators are clearer — do not convert to
  a sequence reflexively.

## Errors and exceptions

- **A pipeline failure is a result, not an exception.** Command and query failures travel as
  `CommandResult` / `QueryResult` with `validationResults`, `exceptionMessages`, and
  `authorizationFailureReason`. Reserve throwing for programming errors and unrecoverable state.
- Argument problems throw `IllegalArgumentException` via `require`; state problems throw
  `IllegalStateException` via `check`. Do not construct those types by hand when the intrinsic
  applies.
- **A named exception type per distinguishable failure**, each carrying the data a handler needs and
  deriving from the closest standard type:

  ```kotlin
  public class UnableToResolveReadModelFromCommandContext(public val readModelType: Class<*>) : IllegalStateException(
      "Cannot resolve read model '${readModelType.name}' because the command context has no key."
  )
  ```

  `DuplicateCommandHandlerException`, `MissingServiceException`, `QueryArgumentException`,
  `InvalidTenantBaseDomainException`, and `MultipleReadModelResolversForCommandException` follow the
  same shape. Messages name the offending type and what to do about it.
- Never catch `Throwable` in application logic. `Exception` is the widest catch used in the
  pipelines, and always after the `CancellationException` rethrow.

## Warnings are errors

`allWarningsAsErrors.set(true)` is configured for every Kotlin module in the root
`build.gradle.kts`. This is a **framework contract**: a warning fails the build.

- **Fix the cause; never suppress to go green.** Deleting an unused import, narrowing a type, or
  handling a `when` branch is the fix.
- `@Suppress` is admissible only where the compiler cannot see a fact you have already proved. The
  entire repository main-source budget is 22 `@Suppress("UNCHECKED_CAST")` — each guarding a cast
  the surrounding code has just type-tested — plus four `@Suppress("UNUSED_PARAMETER")` on
  signature-compatibility parameters. Adding a new suppression kind needs a stated reason in review.
- Deprecation warnings are errors too. When a dependency deprecates something, migrate; do not
  suppress.

## Kotlin conveniences and the Java surface

A Kotlin-only convenience is fine when it is *additive* and hidden from Java. It is wrong when it is
the only way to use a feature.

Acceptable, because Java keeps a first-class path:

- An `inline` + `reified` overload marked `@JvmSynthetic` alongside a `Class<T>` overload —
  `ServiceResolver.resolve()` / `require()` next to `require(type: Class<T>)`.
- A `@get:JvmSynthetic` extension property giving Kotlin `concept.value` while Java keeps
  `concept.value()` (`ConceptAs`, `ArcEnum`, `CommandKeyProvider`, `DerivedTypeRegistry`).
- `@JvmSynthetic` extension functions for ergonomics — `CommandResult.fold`, `getOrThrow`,
  `onSuccess`, `validationOrNull` in `results/ResultExtensions.kt`.
- A lambda-with-receiver DSL *paired* with a Java overload, as in
  `Integrations/Chronicle/.../EventsWithConcurrencyScopes.kt`, which offers both
  `concurrencyScope(id, configure: ConcurrencyScopeBuilder.() -> Unit)` and
  `concurrencyScope(id, configure: Consumer<ConcurrencyScopeBuilder>)`.

Not acceptable in a published surface:

- A `suspend` function as the only way to invoke something a Java host must call.
- A Kotlin function type (`(Any) -> Any?`) as the only parameter shape — declare a `fun interface`
  (`ObservableQueryKeyExtractor`) and adapt.
- `kotlinx.coroutines.flow.Flow` as the only stream type — pair it with
  `java.util.concurrent.Flow.Publisher`.
- Default arguments on an interface method as the only ergonomic entry point; Java gets none of them.
- Extension functions, operator overloads, destructuring, or `Pair`/`Triple` in a signature a Java
  consumer is expected to implement.

Before adding any public declaration, run the checklist in
[kotlin-java-interop.md](./kotlin-java-interop.md).

## Formatting

- No `ktlint`, `detekt`, `spotless`, or `checkstyle` is configured in this build. Formatting is
  governed by `.editorconfig` — UTF-8, LF, four-space indent, trailing whitespace trimmed, final
  newline — and by matching the file you are editing.
- Keep lines within about 120 characters. A handful of main-source lines reach ~140; treat that as
  the ceiling, not the target.
- Imports are explicit; no star imports. Aliases are used where a name collides, always with a
  descriptive alias — `import java.util.concurrent.Flow as JdkFlow`,
  `import java.lang.reflect.Array as ReflectArray`.
- Prefer expression bodies (`= ...`) for single-expression functions, and a trailing comma-free
  parameter list broken one-per-line once it exceeds the line budget.
