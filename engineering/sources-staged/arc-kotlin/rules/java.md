# Java Sources, Fixtures, Tests, and Samples

This file governs the Java that exists in Arc.Kotlin: which modules contain it, why each piece is
there, the compiler contract it is built under (`--release 17`, `-Xlint:all`, `-Werror`), the file
and license conventions, Java test style, and the standing rule that every Java fixture, test, and
sample consumes the **public** Arc surface only. Java is never the implementation language for
framework behavior — Kotlin implements, Java proves the result is usable. How a Kotlin declaration
becomes the JVM signature Java sees is [kotlin-java-interop.md](./kotlin-java-interop.md); Kotlin
style itself is [kotlin.md](./kotlin.md); test layout and naming across languages is
[testing.md](./testing.md).

## Where Java lives, and why

| Location | Count | Why it exists |
| --- | --- | --- |
| `Integrations/SpringBoot/src/main/java/**` | `ArcProperties`, `ArcTenancyProperties`, `IdentityCookieSecurePolicy`, `TenantResolverStrategy` | Spring Boot `@ConfigurationProperties` beans with JavaBean getters and setters, plus the enums they bind |
| `Integrations/Observability/src/main/java/**` | `ArcObservabilityProperties`, `ArcObservationNames`, `ArcObservationTags` | A `@ConfigurationProperties` bean plus stable Micrometer name and tag constant holders |
| `Source/src/test/java/**` | 8 files | Java conformance for the core public surface — adapters, tenancy, authentication, metadata, read-model resolvers |
| `Integrations/*/src/test/java/**` | Spring Boot, Chronicle, Observability, OpenApi, SpringDataJpa, SpringDataMongo | Java conformance for each starter's public surface, plus Java fixture artifacts a Spring context can load |
| `Testing/src/test/java/JavaScenarioConformanceTest.java` | 1 file | Proves the published `arc-testing` scenarios work from ordinary Java |
| `ContractTests/src/testFixtures/java/**` | 30 files | Java records and classes that KSP must process — commands, read models, concepts, map/temporal/optional shapes |
| `ContractTests/src/test/java/**` | 3 files | Java consumer contracts over generated artifacts |
| `ContractTests/src/negativeFixtures/java/**` | 30 files | Java sources that must **fail** KSP with a specific diagnostic |
| `Samples/Java/SpringBoot/**`, `Samples/Java/ChronicleSpringBoot/**` | 2 applications | Runnable proof that a Java Spring Boot application can use Arc end to end |

**There is no `Source/src/main/java`.** `Source/src/main` contains `kotlin/` and `resources/` only.
If you are about to add framework behavior in Java, you are in the wrong language — put it in
Kotlin and, if Java needs a friendlier shape, add an adapter under
`Source/src/main/kotlin/io/cratis/arc/java/`.

## The compiler contract

The root `build.gradle.kts` applies this to **every** module with the `java` plugin — there is no
per-module opt-out:

```kotlin
extensions.configure<JavaPluginExtension> {
    toolchain.languageVersion.set(JavaLanguageVersion.of(17))
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(17)
    options.compilerArgs.addAll(listOf("-Xlint:all", "-Werror"))
}
```

This is a **framework contract**:

- `options.release.set(17)` compiles against the JDK 17 API surface, so a JDK 21 toolchain cannot
  accidentally let a newer method into the sources. Do not replace it with `sourceCompatibility` /
  `targetCompatibility`; `--release` is also what keeps `-Xlint:options` quiet.
- `-Xlint:all -Werror` means **every javac warning is a build failure**.
- The same root block adds `org.junit.jupiter:junit-jupiter:5.11.4` to `testImplementation`, adds
  `junit-platform-launcher` to `testRuntimeOnly`, and applies `useJUnitPlatform()` to every `Test`
  task. Do not re-declare those for the standard `test` source set; an extra source set such as
  `ContractTests`'s `chronicleRealKernelTest` does have to wire its own configurations.

## What `-Xlint:all -Werror` forbids in practice

`-Xlint:all` on JDK 17 enables every category javac supports. The ones that actually bite when
writing Arc consumer code:

- **`rawtypes`** — `ConceptAs` instead of `ConceptAs<UUID>`, `List` instead of `List<TaskView>`.
  Always parameterize. A Kotlin `Class<*>` arrives as `Class<?>`, which is fine; a bare `Class` is
  not.
- **`unchecked`** — an unchecked cast or an unchecked call to a raw-typed member. If a Kotlin API
  hands you `Object` (a `CommandResult<?>` response, a `QueryResult<?>` payload), test with
  `instanceof` and use pattern binding rather than casting blind.
- **`deprecation`** and **`removal`** — using anything Kotlin marked `@Deprecated` or a JDK API
  marked for removal. Migrate; there is no suppression budget for this.
- **`serial`** — a `Serializable` type without `serialVersionUID`. Nothing in this repository
  implements `Serializable`; if you introduce one you own the field.
- **`cast`**, **`fallthrough`**, **`finally`**, **`overloads`**, **`overrides`**, **`static`**,
  **`try`**, **`varargs`**, **`empty`**, **`divzero`** — ordinary correctness warnings. Fix the
  code; none of them has a legitimate suppression in a framework repository.
- **`missing-explicit-ctor`** applies only to exported packages of a named module; this build
  produces no `module-info.java`, so it does not fire here.

Rules:

- **Never add `-Xlint:-<category>`, `-nowarn`, or drop `-Werror` to get a green build.** That
  applies to a module build file as much as to the root.
- `@SuppressWarnings` is a last resort and must be narrowly scoped to the single member that needs
  it, with the specific category named. The whole repository uses it four times:
  `@SuppressWarnings("unchecked")` on one JPA test helper, `@SuppressWarnings("unused")` on three
  Chronicle test fixtures (an IDE-only category, not a javac one), and
  `@SuppressWarnings("rawtypes")` in one negative fixture whose whole purpose is to model bad
  consumer code.
- A warning in a *sample* is as fatal as one in `Source`. Samples are in `./gradlew build`.

## License header and file shape

Every `.java` file starts with exactly these two lines, then a blank line, then `package`:

```java
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

package io.cratis.arc.samples.javaspringboot;
```

- One public type per file, named after the file. Nested records and helper types local to a test
  may live inside the test class (`GeneratedArtifactModuleJavaContractTest`,
  `CommandKeyProviderJavaContractTest` both do this).
- Imports are explicit and alphabetical; no star imports. Static imports go in a separate block
  after a blank line, following the ordinary imports.
- Four-space indent, LF, final newline, no trailing whitespace — `.editorconfig` governs, and no
  formatter or Checkstyle runs in this build.
- Javadoc `/** … */` on every public type and member in `src/main/java`. `ArcProperties` documents
  each getter and setter with `/** Gets … */` / `/** Sets … */`; follow that. Test methods do not
  need Javadoc; a class-level `/** … */` naming the contract under test is the house habit.
- American English in comments and messages.

## Java language level and idioms in use

Target the JDK 17 language, and use only what the repository already uses:

- **`record`** is the default for a command, a read model, an event, a concept, or a value carrier:
  `record CreateTask(String title)`, `record JavaOrderId(UUID value) implements ConceptAs<UUID>`.
- **`final class`** with a private constructor for constant holders (`ArcObservationNames`), and
  `final class` for anything not designed for extension.
- **`enum`** for closed choices (`TenantResolverStrategy`, `IdentityCookieSecurePolicy`).
- **Switch expressions** where they replace a chain of returns
  (`Integrations/SpringBoot/src/main/java/io/cratis/arc/springboot/ArcProperties.java`).
- **`var`** for locals whose type the initializer already states.
- **`List.of` / `Map.of` / `Set.of`** for immutable literals — never `Arrays.asList` or a mutable
  collection you then forget to wrap.
- Not used anywhere here, and needing a reason before you are the first: `sealed`/`permits`, text
  blocks, `module-info.java`, `Serializable`, and lambdas that capture mutable arrays.
- Mutable JavaBean getters and setters appear **only** in Spring `@ConfigurationProperties` types,
  where the binder requires them. Validate in the setter and throw `IllegalArgumentException` with
  a message naming the property, as `ArcProperties` does.

## Java test style

[testing.md](./testing.md) owns test layout and class naming. What is Java-specific:

- Most test classes are **package-private and `final`** — `final class JavaCoreAdaptersTest { … }`,
  `final class TenancyJavaConformanceTest { … }`. A few are package-private without `final`, and the
  two `Samples/Java` test classes are `public class …Tests`. Prefer package-private `final` for a
  new class; match the module you are in rather than converting existing ones.
- Test methods are package-private `void`, named in `lowerCamelCase` as a behavior sentence:
  `resolversAndBlockingProviderBridgesAreJavaFriendly`,
  `blockingAndAsyncCommandAdaptersRunThroughThePrimaryPipeline`,
  `cancellingOpenCancelsTheJavaCompletionStage`. Kotlin's backticked sentence names have no Java
  equivalent; do not import the snake_case variant that appears once in `ContractTests`.
- Assertions are `org.junit.jupiter.api.Assertions.*` **static imports**, one per assertion used —
  `assertEquals`, `assertTrue`, `assertThrows`. No AssertJ, no Hamcrest.
- Await a `CompletionStage` in a test with `.toCompletableFuture().join()`. Prove cancellation and
  ordering with a bounded `CountDownLatch.await(n, TimeUnit.SECONDS)` or
  `ExecutorService.awaitTermination`. There is no `Thread.sleep` anywhere in this repository's Java;
  do not add one.
- Own every executor you create and close it, with try-with-resources:

  ```java
  try (JavaAsyncScope scope = JavaAsyncScope.owningExecutorService(executor)) {
      // ... use scope.commands(pipeline) / scope.queries(pipeline)
  }
  ```

  `JavaAsyncScope.usingExecutor(executor)` when the caller owns the executor,
  `owningExecutorService(executor)` when the scope should shut it down. Blocking test scenarios use
  the same shape: `try (BlockingCommandScenario<T> scenario = new BlockingCommandScenario<>(configured))`.
- Test method names carrying "Java" (`…IsJavaFriendly`, `…FromJava`, `…JavaConformance…`) are how a
  reviewer finds the dual-language coverage. Keep the marker.

## Public API only — no module internals

This is a **framework contract**, enforced by the fact that `internal` Kotlin members are absent
from every `.api` baseline and unusable from a separate compilation unit.

- Java fixtures, tests, and samples consume the published surface: `io.cratis.arc.*` from `Source`,
  `io.cratis.arc.springboot.*` from the starter, `io.cratis.arc.testing.*` from `Testing`. Samples
  depend on `project(":Integrations:SpringBoot")` or `project(":Integrations:Chronicle")` and are
  wired with a plain `@SpringBootApplication`.
- **If a Java sample or fixture cannot express something without reaching past the public API, the
  public API is the defect.** Fix the Kotlin surface — usually by adding a `Blocking*`/`Async*`
  adapter under `io.cratis.arc.java` — instead of widening a visibility or duplicating framework
  logic in the fixture.
- Do not re-implement pipeline behavior in a sample. `Samples/Java/SpringBoot` registers a validator
  through the public seam and nothing else:

  ```java
  @Bean
  public CommandValidator<CreateTask> createTaskValidator() {
      return new BlockingCommandValidatorAdapter<>(new CreateTaskValidator());
  }
  ```

- Never call a Kotlin `suspend` function from Java by passing a hand-built `Continuation`, and never
  reference a `@JvmSynthetic` member. Use the adapters. A Java caller that needs
  `kotlin.coroutines.*` or `kotlin.jvm.functions.*` on its classpath is a design failure to report,
  not to work around. (`Samples/Java/ChronicleSpringBoot` does import
  `kotlin.jvm.JvmClassMappingKt` — that is the *released Chronicle client's* Kotlin-typed API, not
  Arc's, and it is the current known exception.)
- The `apiValidation` block in the root `build.gradle.kts` ignores `ContractTests` and the samples,
  so they carry no `.api` baseline. That is deliberate: they are consumers, not published surface.

## Negative fixtures

`ContractTests/src/negativeFixtures/java/**` is **not a Gradle source set**. It is read as plain
text by `:CodeGeneration:KSP`'s tests through the `arc.contractNegativeFixtures` system property,
so `-Xlint:all -Werror` never runs over it.

- Every file there must be *invalid* for a stated reason, and a KSP test must assert the exact
  `ARCKSP…` diagnostic it produces. `WildcardJavaCommand` (a `List<?>` command property),
  `NonStaticJavaQuery` (an instance query method on a `@ReadModel`), and `RawConceptCommand` (a raw
  `ConceptAs`) are the models.
- Because these files are never compiled by javac, a `@SuppressWarnings` there is about IDE noise
  only and carries none of the weight it would in a real source set.
- Adding a file here changes the KSP negative test, not the `ContractTests` compilation. See
  [ksp.md](./ksp.md).
