# Kotlin/Java Interop — The Public Surface

This file governs the shape of every public declaration in Arc.Kotlin, because that shape is
consumed from two languages. **Kotlin implements; Java is a first-class consumer.** A Kotlin
declaration that reads beautifully in Kotlin and compiles into a signature a Java application cannot
call is a defect, not a trade-off. This file states what each Kotlin construct actually becomes on
the JVM in *this* build, which interop bridges already exist here and must be reused rather than
reinvented, how to verify a surface from Java instead of assuming it works, and where the annotations
genuinely do not help. Kotlin style is [kotlin.md](./kotlin.md); the Java sources that prove all of
this are [java.md](./java.md); design intent is [framework.md](./framework.md).

## The core constraint

- `AGENTS.md`: *"Kotlin is the implementation language; Java is a first-class consumer language.
  Keep public APIs straightforward from Java, avoid Kotlin-only call patterns at public boundaries,
  and verify important APIs from both languages."*
- A Java consumer must never need `kotlin.coroutines.Continuation`,
  `kotlin.jvm.functions.FunctionN`, `kotlinx.coroutines.flow.Flow`, or a hand-written
  `DefaultConstructorMarker` argument to use a public Arc API.
- The canonical proof of the constraint is `ConceptAs`:

  ```kotlin
  public interface ConceptAs<T> {
      /** Returns the scalar value carried by this concept. */
      public fun value(): T
  }

  /** Kotlin property view of the scalar value carried by this concept. */
  @get:JvmSynthetic
  public val <T> ConceptAs<T>.value: T
      get() = value()
  ```

  The abstract member is a *method*, so `record JavaOrderId(UUID value) implements ConceptAs<UUID> {}`
  satisfies it with zero boilerplate (`ContractTests/src/testFixtures/java/.../JavaOrderId.java`).
  Kotlin still gets `concept.value` through a synthetic extension that Java never sees. Had this been
  `val value: T`, Java would have needed `getValue()` and the record would not have worked.

## Ground truth: how to see what Java sees

Never reason about a JVM signature from the Kotlin source. Look at it.

1. **The `.api` baseline** — `Source/api/Source.api`, `Integrations/<Name>/api/<Name>.api`. This is
   the checked-in, gated view of the published surface, produced by
   `binary-compatibility-validator`. It shows JVM descriptors, `synthetic` flags, and generated
   overloads, but **erases generics**.

   ```text
   public abstract interface class io/cratis/arc/commands/CommandPipeline {
       public abstract fun execute (Ljava/lang/Object;Lio/cratis/arc/commands/CommandExecutionOptions;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
   }
   ```

2. **`javap`** on the compiled class, which keeps the generic signature and wildcards the `.api`
   drops. This is the only way to see variance. Run it from the repository root after a build has
   populated `Source/build/classes`:

   ```bash
   javap -cp Source/build/classes/kotlin/main io.cratis.arc.commands.DefaultCommandPipeline
   ```

   `javap` ships with the JDK. If it is not already on `PATH`, point `JAVA_HOME` at a local JDK 17
   and prepend `$JAVA_HOME/bin` for the shell session — never hard-code a machine-specific JDK path
   into a committed file. Add `-v` and read the `flags:` line to confirm `ACC_SYNTHETIC` on a
   `@JvmSynthetic` member.

3. **A Java fixture or test that compiles and runs.** This is the only proof that counts, because
   Java sources here build under `-Xlint:all -Werror`. See
   [Verifying a surface from Java](#verifying-a-surface-from-java).

## What each Kotlin declaration becomes

Verified with `javap` against this repository's compiled classes.

| Kotlin | JVM signature Java sees | Example here |
| --- | --- | --- |
| `public val page: Int` | `int getPage()` | `results/PagingInfo.kt` |
| `public val isValid: Boolean` | `boolean isValid()` | `results/CommandResult.kt` |
| `public var x: T` | `T getX()` + `void setX(T)` | `springboot/ArcProperties.java` mirrors this shape in Java |
| `suspend fun execute(c: Any, o: O): R` | `Object execute(Object, O, Continuation<? super R>)` | `commands/CommandPipeline.kt` |
| `fun f(a: A = d)` | `f(A)` plus a static synthetic `f$default(..., int, Object)` | `queries/ObservableQueryPipeline.kt` |
| `@JvmOverloads constructor(a, b = d)` | real overloads `(a)` and `(a, b)` | `results/CommandResult.kt` |
| companion `fun` | instance method on `Foo$Companion` only | — |
| companion `@JvmStatic fun` | `static` on `Foo` **and** instance on `Foo$Companion` | `results/CommandResult.kt` |
| companion `@JvmField val` | `public static final` field on `Foo` | `tenancy/TenantId.kt` |
| companion `const val` | `public static final` field on `Foo` | `tenancy/TenancyOptions.kt` |
| top-level `fun` in `Foo.kt` | `static` on `FooKt` | `queries/JdkPublisherFlow.kt` → `JdkPublisherFlowKt` |
| `@file:JvmName("X")` + top-level `fun` | `static` on `X` | `commands/CompletionStageAwait.kt` → `CompletionStages` |
| `@JvmSynthetic fun` | `ACC_SYNTHETIC`; javac refuses to reference it | `results/ResultExtensions.kt` |
| `Any` / `Any?` | `java.lang.Object` | everywhere |
| `Class<*>` | `Class<?>` | `polymorphism/DerivedTypeRegistry.kt` |
| `((Any) -> Any?)?` | `kotlin.jvm.functions.Function1<Object, ? extends Object>` | `queries/ObservableQueryPipeline.kt` |
| `Flow<T>` | `kotlinx.coroutines.flow.Flow` | `queries/ObservableQueryPipeline.kt` |
| interface member with a body (in `Source`) | real `default` method **and** a `$DefaultImpls` class | `queries/QueryPerformer.kt` |

## Default arguments and `@JvmOverloads`

Kotlin default arguments are invisible to Java. The compiler emits one method plus a
`name$default(..., int mask, Object marker)` synthetic bridge that no Java caller should touch.

- **Put `@JvmOverloads` on every public constructor and concrete function that has a default
  argument and that Java is expected to call.** There are 113 uses in this repository.
  `CommandResult`'s `@JvmOverloads constructor` produces seven real constructors in
  `Source/api/Source.api`, from `(UUID)` up to the full seven-parameter form.
- The Kotlin documentation states the rule precisely: *"For every parameter with a default value,
  this generates one additional overload, which has this parameter and all parameters to the right
  of it in the parameter list removed."* Order your parameters so that the truncated overloads are
  the ones a caller actually wants — the most important parameters first, the rarely-overridden ones
  last.
- **`@JvmOverloads` cannot be used on an abstract method, including any interface method.** This is
  the single most common interop trap here. `ObservableQueryPipeline.open` has two defaults and is
  an interface method, so Java sees only:

  ```text
  public abstract java.lang.Object open(QueryRequest, QueryExecutionOptions, ObservableQueryTransferMode,
      kotlin.jvm.functions.Function1<java.lang.Object, ? extends java.lang.Object>,
      kotlin.coroutines.Continuation<? super ObservableQueryOpenResult>);
  ```

  which is unusable from Java. That is exactly why `io.cratis.arc.java.AsyncObservableQueryPipeline`
  exists, with three real `open(...)` overloads and an `ObservableQueryKeyExtractor` fun interface in
  place of `Function1`. **When an interface method needs defaults, add a Java-facing facade; do not
  leave Java with the raw form.**
- Secondary constructors are the other tool. `PagingInfo` adds one purely for Java's benefit:

  ```kotlin
  /** Java- and source-compatible convenience overload for integer totals. */
  public constructor(page: Int, size: Int, totalItems: Int) : this(page, size, totalItems.toLong())
  ```

## Companion objects, statics, and constants

- A companion member without `@JvmStatic` is reachable from Java only as
  `Foo.Companion.member(...)`. **Annotate every companion factory a Java caller should use with
  `@JvmStatic`.** `CommandResult.success(...)`, `QueryResult.error(...)`, `TenantId.of(...)`,
  `ArcOneOf.of(...)`, and `JavaAsyncScope.usingExecutor(...)` all do; `javap` then shows both
  `public static final ... success(java.util.UUID)` on the class and the instance method on
  `Foo$Companion`.
- **`@JvmField` for a companion `val` constant of a reference type** — the field lands directly on
  the enclosing class:

  ```kotlin
  public companion object {
      /** Tenant identifier used when no tenant has been selected. */
      @JvmField
      public val NOT_SET: TenantId = TenantId("[NotSet]")
  }
  ```

  Java writes `TenantId.NOT_SET`, not `TenantId.Companion.getNOT_SET()`.
- **`const val` for compile-time `String`/primitive constants** — `TenancyOptions.DEFAULT_HEADER_NAME`
  becomes `public static final field DEFAULT_HEADER_NAME Ljava/lang/String;` and can be used in a
  Java annotation argument or `switch` label. `@JvmField` cannot do that; `const` cannot hold an
  object.
- `@JvmField` is only legal on a property that has a backing field, is not `private`, and has no
  `open`, `override`, or `const` modifier.

## Top-level declarations and file classes

- Top-level functions and properties compile into a class named after the file with `Kt` appended.
  `JdkPublisherFlow.kt` → `JdkPublisherFlowKt`.
- **Give any file whose top-level functions Java is meant to call an explicit `@file:JvmName`**, so
  the Java-visible class name is designed rather than accidental. The five in this repository are:

  | File | Java class |
  | --- | --- |
  | `commands/CompletionStageAwait.kt` | `CompletionStages` |
  | `commands/ServiceResolverExtensions.kt` | `ServiceResolvers` |
  | `identity/UsersProvider.kt` | `UsersProviders` |
  | `identity/AsyncIdentityDetailsProviderAdapter.kt` | `IdentityDetailsProviders` |
  | `tenancy/TenantsProvider.kt` | `TenantsProviders` |

  `Integrations/Chronicle` adds `ChronicleCommandResponses` and `ChronicleCommandScenarios`, and
  `Documentation/guides/testing.md` shows Java calling
  `ChronicleCommandScenarios.chronicle(configured)` for what is a Kotlin extension function.
- `@JvmMultifileClass` is not used here. If you ever need two files to share a facade name, add it
  to *both* files.
- Renaming a file, or adding/removing `@file:JvmName`, is a **binary-breaking change** for Java
  callers even though nothing changed for Kotlin. It will show up in `apiCheck`.

## `@JvmSynthetic` and the Kotlin-only property view

`@JvmSynthetic` sets `ACC_SYNTHETIC`, so javac refuses to reference the member while Kotlin resolves
it normally. Confirm with `javap -v`:

```text
public static final java.lang.Object getOrThrow(io.cratis.arc.results.CommandResult);
  flags: (0x1019) ACC_PUBLIC, ACC_STATIC, ACC_FINAL, ACC_SYNTHETIC
```

Two sanctioned uses, and no others:

1. **The property view over a method-shaped SPI.** The SPI member is `fun value(): T` so Java records
   implement it for free; Kotlin gets property syntax from a synthetic extension. Used by
   `ConceptAs.value`, `ArcEnum.wireValue`, `CommandKeyProvider.key`,
   `DerivedTypeRegistry.baseTypes`, and `CanResolveReadModelForCommand.types` / `.ownership`.

2. **A Kotlin-only ergonomic overload that has a Java-visible sibling.**

   ```kotlin
   /** Resolves [type] or throws a deterministic [MissingServiceException]. */
   public fun <T : Any> ServiceResolver.require(type: Class<T>): T = resolve(type) ?: throw MissingServiceException(type)

   /** Resolves a service using its reified Kotlin type or throws [MissingServiceException]. */
   @JvmSynthetic
   public inline fun <reified T : Any> ServiceResolver.require(): T = require(T::class.java)
   ```

   Also used to hide Kotlin-typed factories that would otherwise tempt Java into constructing a
   `CoroutineScope`: `AsyncCommandPipeline.fromCoroutineScope`, `AsyncQueryPipeline.fromCoroutineScope`,
   and `AsyncAuthentication.fromCoroutineScope` are `@JvmStatic @JvmSynthetic`, documented as
   *"Kotlin host-integration factory; Java callers should use JavaAsyncScope."*

**`@JvmSynthetic` does not remove a member from the `.api` baseline.** It appears there marked
`synthetic`, and `apiCheck` still gates it. It is an ergonomics tool, not a way to keep a surface out
of the published contract — use `internal` for that.

## `suspend` from Java: the async adapter contract

A `suspend` function is not callable from Java in any practical sense. Java sees a trailing
`Continuation` parameter and an `Object` return; implementing one by hand is out of the question.

**This repository already has a complete, consistent bridge. Reuse it. Do not invent a second one.**

### Consuming Arc from Java

`io.cratis.arc.java.JavaAsyncScope` is the single entry point. It is `AutoCloseable`, owns a
`CoroutineScope(SupervisorJob() + executor.asCoroutineDispatcher())`, and hands out
`CompletionStage`-shaped facades:

```java
try (JavaAsyncScope scope = JavaAsyncScope.owningExecutorService(Executors.newFixedThreadPool(2))) {
    AsyncCommandPipeline commands = scope.commands(pipeline);
    CommandResult<?> result = commands.execute(command, options).toCompletableFuture().join();
}
```

- `usingExecutor(Executor)` — the caller keeps ownership of the executor.
- `owningExecutorService(ExecutorService)` — the scope shuts the executor down in `close()`.
- Facades: `commands(...)` → `AsyncCommandPipeline`, `queries(...)` → `AsyncQueryPipeline`,
  `authentication(...)` → `AsyncAuthentication`, `observableQueries(...)` →
  `AsyncObservableQueryPipeline`, `queryHealth(...)` → `java.util.concurrent.Flow.Publisher`.
- `Testing` mirrors the pattern for tests: `BlockingCommandScenario`, `BlockingQueryScenario`,
  `AsyncCommandScenario`, `AsyncQueryScenario`, `AsyncObservableQueryScenario`.

### Implementing an Arc SPI from Java

For every suspending SPI, `io.cratis.arc.java` publishes a matched triple: a `Blocking*` interface, an
`Async*` interface returning `CompletionStage`, and a `*Adapter` class implementing the suspending
contract. Register the *adapter* as the bean.

| Suspending SPI | Java-facing pair | Adapters |
| --- | --- | --- |
| `CommandFilter` | `BlockingCommandFilter` / `AsyncCommandFilter` | `BlockingCommandFilterAdapter`, `AsyncCommandFilterAdapter` |
| `AuthorizationCommandFilter` | `BlockingAuthorizationCommandFilter` / `Async…` | `…Adapter` pair (preserves filter ordering) |
| `QueryFilter`, `AuthorizationQueryFilter` | `Blocking…` / `Async…` | `…Adapter` pair |
| `CommandValidator<T>`, `QueryValidator` | `BlockingCommandValidator<T>` / `Async…` | `…Adapter` pair |
| `AuthorizationPolicy` | `BlockingAuthorizationPolicy` / `Async…` | `…Adapter` pair |
| `CommandExecutionScope` | `BlockingCommandExecutionScope` / `Async…` | `…Adapter` pair |
| `CommandResponseValueHandler` | `Blocking…` / `Async…` | `…Adapter` pair |
| `CommandHandler`, `QueryPerformer` | `BlockingCommandHandler` / `Async…`, `BlockingQueryPerformer` / `Async…` | `…Adapter` pair |
| `TenantsProvider`, `UsersProvider`, `IdentityDetailsProvider<T>` | `AsyncTenantsProvider`, `AsyncUsersProvider`, `AsyncIdentityDetailsProvider<T>` | `…Adapter` + a Kotlin `as…Provider()` extension |
| `AuthenticationHandler` | `AsyncAuthenticationHandler` | `AsyncAuthenticationHandlerAdapter` |

Java registers one like this (`Samples/Java/SpringBoot/.../JavaSampleApplication.java`):

```java
@Bean
public CommandValidator<CreateTask> createTaskValidator() {
    return new BlockingCommandValidatorAdapter<>(new CreateTaskValidator());
}
```

The adapter body is always the same three lines — delegate, and `await()` the stage:

```kotlin
public class AsyncCommandFilterAdapter(private val filter: AsyncCommandFilter) : CommandFilter {
    override suspend fun execute(context: CommandContext): CommandResult<*> = filter.execute(context).await()
}
```

`io.cratis.arc.commands.await` (published as `CompletionStages.await` and marked `@JvmSynthetic` for
Java) is the **only** stage-to-coroutine bridge. It uses `suspendCancellableCoroutine`, unwraps
`CompletionException`, and cancels the underlying `Future` from `invokeOnCancellation`. Do not write
another.

### Cancellation across the bridge

Cancellation is cooperative in both directions, and every facade in this repository implements the
same handshake — see `AsyncCommandPipeline.launch`, `AsyncQueryPipeline.perform`,
`AsyncAuthentication.handleAuthentication`, and `AsyncObservableQueryPipeline`:

```kotlin
job = coroutineScope.launch {
    try {
        future.complete(operation())
    } catch (exception: CancellationException) {
        future.cancel(false)
        throw exception
    } catch (exception: Exception) {
        future.completeExceptionally(exception)
    }
}
future.whenComplete { _, _ -> if (future.isCancelled) job.cancel() }
job.invokeOnCompletion { cause ->
    if (cause != null && !future.isDone) {
        if (cause is CancellationException) future.cancel(false) else future.completeExceptionally(cause)
    }
}
```

Any new facade must reproduce all four parts: rethrow `CancellationException`, cancel the future on
coroutine cancellation, cancel the job when the future is cancelled, and complete exceptionally
otherwise. The tests that hold this contract are
`JavaObservableAdaptersTest.cancellingOpenCancelsTheJavaCompletionStage` and
`JavaCoreAdaptersTest.closingAnOwnedScopeCancelsInFlightStagesAndShutsDownItsExecutor`, both under
`Source/src/test/java/io/cratis/arc/conformance/`.

## `Flow` versus `Flow.Publisher`

`kotlinx.coroutines.flow.Flow` is Kotlin-only in practice. The repository's rule is: **Kotlin
observable APIs speak `Flow`; the Java-facing surface speaks `java.util.concurrent.Flow.Publisher`,
and two adapters convert between them.**

- `ObservableQueryOpenResult.Stream` carries `Flow<QueryResult<*>>`;
  `AsyncObservableQueryOpenResult.Stream` carries `JdkFlow.Publisher<QueryResult<*>>`. Both are
  `sealed interface` hierarchies with the same two cases.
- `CoroutineFlowPublisher` (`java/AsyncObservableQueryPipeline.kt`) turns a `Flow` into a **cold,
  demand-aware** `Flow.Publisher`: one collection per subscriber, emission only against positive
  demand, `IllegalArgumentException` on non-positive `request`, single terminal signal.
- `JdkFlow.Publisher<T>.asKotlinFlow()` (`queries/JdkPublisherFlow.kt`) is the reverse, built on
  `callbackFlow` with one-at-a-time `request(1)` and `awaitClose { subscription?.cancel() }`.
  `BlockingQueryPerformerAdapter` and `AsyncQueryPerformerAdapter` call it automatically, so a Java
  observable query simply returns a `Flow.Publisher` — see
  `Samples/Java/SpringBoot/.../TaskView.java`:

  ```java
  @Path("/api/tasks/observe")
  public static Flow.Publisher<List<TaskView>> observe(@FromServices TaskRepository repository) {
      return repository.observe();
  }
  ```

- Do not introduce Reactive Streams (`org.reactivestreams`) or Project Reactor types into a published
  Arc signature. The JDK `Flow` types are already the bridge, and they cost no dependency.

## Nullability across the boundary

- Kotlin **does** emit `org.jetbrains.annotations.@NotNull` / `@Nullable` into the bytecode of
  public members, and `Intrinsics.checkNotNullParameter` guards at the top of every public function.
  `javap -v` on `io.cratis.arc.tenancy.TenantResolutionContext` shows both.
- **javac does not enforce those annotations.** They are IDE and static-analysis signal only. The
  Kotlin documentation is explicit: *"nobody prevents us from passing `null` as a non-nullable
  parameter. That's why Kotlin generates runtime checks for all public functions that expect
  non-nulls."* The consequence is a `NullPointerException` at the boundary, not a compile error and
  not a validation result.
- Therefore: where a `null` from Java is a *usage* error the pipeline should report, validate it
  explicitly and return a `ValidationResult`. Where it is a programming error, the intrinsic check
  is the right outcome.
- Going the other way, Java types without nullability annotations arrive in Kotlin as **platform
  types** (`T!`), which suppress Kotlin's null checks. Never let a platform type flow untested into
  a non-null Kotlin property. Assign it to an explicitly nullable type and handle `null`.
- This repository declares **no JSR-305, JetBrains, or JSpecify nullability annotations of its own**
  in Kotlin or in Java main sources. The two `Nullable` annotation types under
  `ContractTests/src/{testFixtures,negativeFixtures}/java` are local test fixtures: KSP's Java
  metadata path recognizes any annotation whose simple name is `Nullable` or `CheckForNull`
  (`CodeGeneration/KSP/.../JavaRecordParser.kt`, `MetadataCollector.kt`), which is how a Java record
  component declares an optional property to the generator. That is a *code-generation* signal, not
  a compiler one.

## Generics, variance, and platform types

- Kotlin's `out` variance becomes a Java wildcard **in parameter position**, and only when the type
  argument is not final. `DefaultCommandPipeline` takes `Iterable<CommandFilter>` in Kotlin, and
  Java sees:

  ```text
  public DefaultCommandPipeline(CommandHandlerRegistry,
      java.lang.Iterable<? extends CommandFilter>, java.lang.Iterable<? extends CommandExecutionScope>, ...)
  ```

  which is what lets `JavaCoreAdaptersTest` pass a `List.of(...)` of mixed filter implementations.
  By contrast `CommandResult`'s constructor takes `List<ValidationResult>` with **no** wildcard,
  because `ValidationResult` is a final class. Do not guess which case you are in — run `javap`.
- `@JvmSuppressWildcards` and `@JvmWildcard` are **not used anywhere in this repository**. If you
  reach for one, that is a signal the signature is too clever; prefer changing the parameter type.
- Return types never get wildcards, per the Kotlin documentation: *"wildcards are not generated,
  because otherwise Java clients will have to deal with them."*
- `Class<*>` is the house choice for a runtime type token (`DerivedTypeRegistry`,
  `CommandValidator.commandType`, `CanResolveReadModelForCommand.readModelTypes()`), because it maps
  to a clean `Class<?>` and avoids `KClass`, which Java can only obtain through
  `JvmClassMappingKt.getKotlinClass(...)`.
- **Never put `KClass`, `KType`, `KFunction`, `Pair`, `Triple`, `Unit`, or `Nothing` in a public
  signature Java has to touch.** `Nothing` in particular is erased to a raw type. `Pair` appears in
  a Kotlin *sample* command's return value (`Samples/Kotlin/SpringBoot/.../CreateTask.kt`) where KSP
  unwraps it; that is generated-artifact input, not a published API.
- Generics are not reified on either side. A cast that the surrounding code has already type-tested
  is annotated `@Suppress("UNCHECKED_CAST")` in Kotlin and `@SuppressWarnings("unchecked")` in Java;
  anything wider is a design problem.

## Inline value classes

- **Do not introduce `@JvmInline value class` into a published Arc surface.** There is not a single
  one in this repository — the grep is empty.
- The reason is the mangling rule: Kotlin compiles inline value classes to their unboxed
  representation, and any public function that takes one gets a name suffix (`foo-<hash>`) that Java
  cannot type. The Kotlin documentation states it plainly: *"By default, Kotlin compiles inline value
  classes to use unboxed representations, which are often inaccessible from Java."*
- `@JvmExposeBoxed` exists but is experimental (`@OptIn(ExperimentalStdlibApi::class)`) and is not
  used here. Do not adopt it to rescue a value-class design; choose a different design.
- The house alternative is a **`data class` implementing `ConceptAs<T>`** with a private backing
  property, which gives Java a normal class with a normal accessor:

  ```kotlin
  public data class TenantId(private val rawValue: String) : ConceptAs<String> {
      /** Returns the tenant identifier's wire value. */
      override fun value(): String = rawValue
  ```

  `javap` confirms Java gets `TenantId(String)`, `String value()`, `isDefault()`, `copy`, `equals`,
  `hashCode`, `toString`, the three `@JvmField` constants, and the `@JvmStatic of(String)` factory —
  and, because the backing property is `private`, **no** `getRawValue()` and **no** `component1()`.
  That is deliberate: a private constructor property keeps `componentN` out of the published API.
- When a *dependency* exposes an inline value class, wrap it. `Integrations/Chronicle` adds a
  `Long`-typed overload rather than re-exporting Chronicle's `EventSequenceNumber`:

  ```kotlin
  /** Adds an exact expected event-log position without exposing Chronicle's Kotlin inline value class to Java. */
  public fun expectedSequenceNumber(eventSourceId: String, sequenceNumber: Long): EventsWithConcurrencyScopesBuilder
  ```

## Sealed types, exhaustiveness, and default methods

- A `sealed interface` compiles to an ordinary Java interface. **Java gets no exhaustiveness
  checking** — this build produces no `sealed`/`permits` Java declarations, and a Java consumer must
  write an `instanceof` chain with a fail-closed `else`. Keep the case count small and each case's
  payload obvious, as `ObservableQueryOpenResult` does with `Failure(result)` and `Stream(results)`.
- Consequently, **adding a case to a public sealed hierarchy is a source-breaking change for Java
  consumers** even though Kotlin only warns them via a non-exhaustive `when`. Treat it as a breaking
  change and say so in the changelog.
- `Source/build.gradle.kts` sets `compilerOptions.jvmDefault.set(JvmDefaultMode.ENABLE)`. In
  `Source`, an interface member with a body therefore becomes a **real JVM `default` method** plus a
  `$DefaultImpls` compatibility class:

  ```text
  public interface io.cratis.arc.queries.QueryPerformer {
    public abstract QueryDescriptor getDescriptor();
    public default boolean getAllowsAnonymous();
    public default boolean getSupportsPaging();
  }
  ```

  This is why a Java implementer of `BlockingCommandHandler` can skip `resolveCommandKey` and
  `prepare` and only write `getCommandType`, `getMetadata`, and `invoke`.
- Other modules inherit the compiler's default mode unless they configure it explicitly. If you
  add a bodied interface member outside `Source`, inspect the emitted methods and compatibility
  classes with `javap` rather than assuming either abstract or default dispatch. Compiler upgrades
  can also add declared forwarding bridges on implementation classes; review those ABI changes.
- `@JvmDefault` appears nowhere in this repository. The typed `jvmDefault` compiler option is the
  mechanism this build uses; do not reach for the annotation or the deprecated `-Xjvm-default` flag.

## Checked exceptions

- **Kotlin has no checked exceptions, and this repository declares none.** `@Throws` is used zero
  times. A Kotlin function that throws `IOException` is, to javac, a function that throws nothing,
  so Java callers cannot `catch (IOException e)` on it without a compile error and cannot be forced
  to handle it.
- That is compatible with the design, because **Arc reports failures as results, not exceptions**:
  `CommandResult` and `QueryResult` carry `validationResults`, `exceptionMessages`,
  `exceptionStackTrace`, and `authorizationFailureReason`. Java handles a failure by inspecting
  `isSuccess`, not by catching.
- Do not add `@Throws` to make a Kotlin API feel Java-ish. Add it only if a Java caller genuinely
  must catch a specific checked type — and then verify it from a Java test, because `@Throws` changes
  the JVM signature and therefore the `.api` baseline.
- A `CompletionStage` from an Arc facade completes exceptionally with the original cause (the
  facades unwrap `CompletionException` on the way in). Java sees the wrapped form on `join()`; test
  for the cause, not the wrapper.

## Annotation use-site targets

Kotlin annotations land on the *property* by default, which is often invisible where Java, Jackson,
or Jakarta Validation looks. Always state the target.

- `@get:JsonProperty("isSuccess")` on `CommandResult.isSuccess` puts the Jackson annotation on the
  getter, which is what the serializer reads.
- `@get:JvmName("isDefault")` on `TenantId.isDefault` names the getter explicitly. Kotlin's
  `is`-prefix rule already yields `isDefault()` — `CommandResult.isAuthorized`, `isValid`, and
  `isSuccess` rely on the rule with no annotation — so treat the explicit form as documentation of
  intent, not as a fix.
- `@get:JvmSynthetic` on an extension property hides the accessor from Java; the bare `@JvmSynthetic`
  form applies to a function.
- `@get:JsonInclude(JsonInclude.Include.NON_DEFAULT)` and
  `@get:JsonProperty(access = JsonProperty.Access.WRITE_ONLY)` follow the same rule
  (`queries/ObservableQueryProtocol.kt`, `metadata/ParameterDescriptor.kt`).
- Arc's own annotations declare an explicit `@Target` and `AnnotationRetention.RUNTIME` so both KSP
  and Java see them — `@Command`, `@ReadModel`, `@Path`, `@DerivedType`, `@ArcEnumValue`, `@Flags`.
  Jakarta constraints in `validation/StandardStringConstraints.kt` additionally target
  `AnnotationTarget.FIELD, PROPERTY_GETTER, VALUE_PARAMETER, ANNOTATION_CLASS` precisely so a Java
  record component and a Kotlin constructor property both work.

## Properties versus builders

- For a small, fully-specified value, use a constructor with `@JvmOverloads`. `CommandResult`,
  `QueryResult`, `ValidationResult`, `TenantResolutionContext`, and `TenancyOptions` are all
  constructed directly from Java.
- For an ordered, validated composition, publish a **fluent builder that returns `this`**, entered
  through a `@JvmStatic` factory. `EventsWithConcurrencyScopesBuilder` is the model, and it shows the
  right way to offer a Kotlin DSL without penalizing Java — the same operation exists as a
  receiver-lambda overload *and* a `java.util.function.Consumer` overload:

  ```kotlin
  /** Builds a Chronicle concurrency scope with a Kotlin receiver. */
  public fun concurrencyScope(eventSourceId: String, configure: ConcurrencyScopeBuilder.() -> Unit): EventsWithConcurrencyScopesBuilder

  /** Builds a Chronicle concurrency scope with a Java [Consumer]. */
  public fun concurrencyScope(eventSourceId: String, configure: Consumer<ConcurrencyScopeBuilder>): EventsWithConcurrencyScopesBuilder
  ```

- Never publish a receiver-lambda DSL as the only entry point. `configure: T.() -> Unit` is
  `Function1<T, Unit>` to Java, which requires returning `kotlin.Unit` explicitly.
- Mutable JavaBean getter/setter pairs belong only in Spring `@ConfigurationProperties` types, which
  are written in Java for that reason (`Integrations/SpringBoot/src/main/java/.../ArcProperties.java`).

## Verifying a surface from Java

**"It should work from Java" is not a verification.** A public API change is not done until Java
source that exercises it compiles under `-Xlint:all -Werror` and runs.

1. Pick the right home: core surface → `Source/src/test/java/io/cratis/arc/conformance/`; a starter →
   `Integrations/<Name>/src/test/java/`; generated artifacts → `ContractTests/src/test/java/` with
   fixtures in `ContractTests/src/testFixtures/java/`; end-to-end → `Samples/Java/**`.
2. Write a package-private `final class …JavaConformanceTest` / `…JavaContractTest` whose method
   name states the claim — `resolversAndBlockingProviderBridgesAreJavaFriendly`.
3. Call the API the way a real consumer would: no `Continuation`, no `FunctionN`, no
   `Foo.Companion.`, no reflection. If you need any of those to make it compile, the surface is
   wrong — fix the Kotlin, not the test.
4. Await through `CompletionStage.toCompletableFuture().join()` and close every scope with
   try-with-resources.
5. Regenerate the baseline (`./gradlew apiDump`) and commit the `.api` diff in the same commit;
   confirm the new signatures read the way you intended.
6. Run the gates in [general.md](./general.md). `ContractTests` is mandatory when a public contract
   moved.

## Checklist for a new public declaration

Run this over every public Kotlin declaration before you call it done.

1. Does it have KDoc, an explicit `public`, and the standard license header?
2. Does any parameter have a default value? If it is a constructor or concrete function, is it
   `@JvmOverloads`? If it is an interface method, is there a Java-facing facade, since
   `@JvmOverloads` is illegal there?
3. Is it a companion member Java should call? Then `@JvmStatic`. A constant? `@JvmField` for a
   reference, `const val` for a `String` or primitive.
4. Is it a top-level function Java should call? Does the file carry an intentional `@file:JvmName`?
5. Is it `suspend`? Then Java needs an `Async*`/`Blocking*` pair and a `*Adapter` in
   `io.cratis.arc.java`, or a facade obtained from `JavaAsyncScope` — reusing `await()` and the
   four-part cancellation handshake.
6. Does any signature mention `Flow`, `Function1`, `KClass`, `Pair`, `Triple`, `Unit`, `Nothing`, or
   an inline value class? Replace it: `Flow.Publisher`, a `fun interface`, `Class<*>`, a named type.
7. Is it a property whose annotation must land on the accessor? Use `@get:` / `@set:`.
8. Is it a Kotlin-only convenience? Then it is `@JvmSynthetic`, and a Java-visible sibling exists.
9. Run `javap` on the compiled class. Do the wildcards, the nullability annotations, and the
   generated overloads read the way a Java author would expect?
10. Does a Java fixture, test, or sample actually call it, and does `./gradlew build` stay at zero
    warnings?
11. Is the `.api` diff in the same commit, and is it the diff you intended?

## What annotations do not fix

Be honest about the limits; do not reach for an annotation that cannot help.

- **`@JvmOverloads` on an interface or abstract method** — illegal. Java gets none of your defaults.
  Build a facade.
- **`@JvmName` to rename an override** — not a supported use. The Kotlin reference documents
  `@JvmName` for naming a file class, resolving signature clashes from erasure, and renaming
  property accessors — not for changing the JVM name of a member that participates in overriding.
  Rename on the supertype, or add a differently named member that delegates.
- **`@JvmStatic` on a top-level function** — it buys nothing; top-level functions are already
  compiled to `static` methods on the file class.
- **`@JvmSynthetic` as an API-hiding mechanism** — the member remains in the `.api` baseline and in
  the published binary. `internal` is what removes something from the surface.
- **`@JvmField` on an `open`, `override`, `const`, `private`, or delegated property** — not
  permitted; `@JvmField` requires a non-private property with a backing field and none of those
  modifiers.
- **Any annotation that makes `suspend` callable from Java** — none exists. Only an adapter does.
- **Any annotation that gives Java exhaustiveness over a Kotlin `sealed` hierarchy** — none exists.
- **`@Throws` as a way to document failure modes** — it changes the JVM signature and the `.api`
  baseline while doing nothing for Kotlin callers. Use KDoc and the result envelope.
- **`@JvmSuppressWildcards` as a shortcut past an awkward variance** — it changes a *published*
  signature. Redesign the parameter type instead, and verify with `javap`.
