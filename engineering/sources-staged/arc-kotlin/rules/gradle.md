# Gradle Build, Modules, and Baselines

This rule governs the Gradle workspace: how the multi-module build is wired, where convention
configuration lives, how a module is added, how the checked-in `.api` binary-compatibility baselines
are maintained, which modules publish and how, and the exact gate commands. Module boundaries and
dependency direction are stated authoritatively in [AGENTS.md](../../AGENTS.md); this file is the
build-level depth behind that contract. When the two disagree, `AGENTS.md` wins.

## Running Gradle here

- Always use the wrapper: `./gradlew`. It is pinned to Gradle 8.14.4 with a `distributionSha256Sum` in
  `gradle/wrapper/gradle-wrapper.properties`, and CI validates it with
  `gradle/actions/wrapper-validation`.
- A **JDK 17 toolchain must be resolvable** before any Gradle invocation. If `java` is not on `PATH`,
  export `JAVA_HOME` to a local JDK 17 installation and prepend `$JAVA_HOME/bin` to `PATH` for the
  command. Never commit a machine-specific JDK path into any file in this repository.
- Pass `--no-configuration-cache` wherever CI does — see the gate table below. Those tasks
  (`typeScriptBuild`, `typeScriptRuntimeTest`, `verifyContractTestProxyDeterminism`,
  `chronicleRealKernelTest`, publishing) are run that way in `.github/workflows/`, so reproduce the
  gate exactly rather than inventing a shorter command.

## Module map

`settings.gradle.kts` includes exactly these projects under the root `arc-kotlin-workspace`.

| Project path | Published coordinates | Notes |
| --- | --- | --- |
| `:Source` | `io.cratis:arc` | Host-agnostic runtime; no Spring, no Chronicle |
| `:CodeGeneration:KSP` | `io.cratis:arc-ksp` | KSP processor; depends on `:Source` |
| `:GradlePlugin` | `io.cratis:arc-gradle-plugin` | `io.cratis.arc` plugin; depends on `:Source` |
| `:Integrations:SpringBoot` | `io.cratis:arc-spring-boot-starter` | Web/websocket/security are `compileOnly` |
| `:Integrations:SpringDataJpa` | `io.cratis:arc-spring-data-jpa` | |
| `:Integrations:SpringDataMongo` | `io.cratis:arc-spring-data-mongodb` | |
| `:Integrations:OpenApi` | `io.cratis:arc-openapi-spring-boot-starter` | |
| `:Integrations:Observability` | `io.cratis:arc-observability-spring-boot-starter` | OpenTelemetry is `compileOnly` |
| `:Integrations:Chronicle` | `io.cratis:arc-chronicle-spring-boot-starter` | Optional; depends on the released Chronicle client |
| `:Testing` | `io.cratis:arc-testing` | `api(project(":Source"))` |
| `:ContractTests` | none — unpublished | Fixtures, cross-language contracts, TypeScript gates |
| `:Samples:{Kotlin,Java}:{SpringBoot,ChronicleSpringBoot}` | none — unpublished | `group = io.cratis.samples`, `version = 1.0.0` |

Optionality is expressed with `compileOnly` / `compileOnlyApi` in the integration build files. When
you add a dependency to an integration, decide deliberately between `api`, `implementation`, and
`compileOnly`; a `compileOnly` dependency that a consumer must always supply is how this repository
keeps starters optional.

## Where configuration lives

Cross-cutting configuration is centralized in the root `build.gradle.kts` and applied reactively.
Do not repeat it in a module build file.

```kotlin
subprojects {
    pluginManager.withPlugin("org.jetbrains.kotlin.jvm") {
        extensions.configure<KotlinJvmProjectExtension> { jvmToolchain(17) }
        tasks.withType<KotlinJvmCompile>().configureEach {
            compilerOptions {
                jvmTarget.set(JvmTarget.JVM_17)
                allWarningsAsErrors.set(true)
            }
        }
    }

    pluginManager.withPlugin("java") {
        extensions.configure<JavaPluginExtension> {
            toolchain.languageVersion.set(JavaLanguageVersion.of(17))
        }
        tasks.withType<JavaCompile>().configureEach {
            options.release.set(17)
            options.compilerArgs.addAll(listOf("-Xlint:all", "-Werror"))
        }
        dependencies.add("testImplementation", "org.junit.jupiter:junit-jupiter:5.11.4")
        dependencies.add("testRuntimeOnly", "org.junit.platform:junit-platform-launcher")
        tasks.withType<Test>().configureEach { useJUnitPlatform() }
    }
}
```

Centralized at the root: JVM toolchain 17, `jvmTarget`/`--release 17`, `allWarningsAsErrors`,
`-Xlint:all -Werror`, JUnit Jupiter 5.11.4 plus the platform launcher, `useJUnitPlatform()`,
`group = "io.cratis"`, the `version` property fallback, dependency-update rejection of non-stable
candidates, the `apiCheck mustRunAfter apiDump` ordering, and `apiValidation.ignoredProjects`.

Owned per module: the plugin set, dependencies and their configuration scopes, `mavenPublishing`
coordinates and POM, KSP arguments, and any module-specific verification task.

## Adding a module

1. Add `include("<Path>")` to `settings.gradle.kts` in the existing grouping order.
2. Create `<Path>/build.gradle.kts` starting with the standard Cratis MIT header, then the plugin
   block. Apply `kotlin("jvm")` and `` `java-library` ``; add `kotlin("plugin.spring")` only for a
   Spring integration. Do not re-declare toolchains, warning levels, or JUnit — the root supplies
   them.
3. Declare dependencies with the narrowest scope that works, using `project(":...")` for internal
   modules. Respect the dependency direction in `AGENTS.md`.
4. If the module is published, add the `com.vanniktech.maven.publish` plugin, a `mavenPublishing`
   block with `publishToMavenCentral()`, `signAllPublications()`,
   `coordinates("io.cratis", "<artifact>", version.toString())`, and the same POM shape as the
   sibling modules (name, description, MIT license, `cratis` developer, SCM URLs).
5. If the module is published, it needs a checked-in `.api` baseline — generate it once with
   `./gradlew :<Path>:apiDump` and commit `<Path>/api/<Name>.api`. Add
   `tasks.named("apiCheck") { mustRunAfter(tasks.named("apiDump")) }` as the sibling modules do.
6. If the module must **not** be validated, extend `apiValidation { ignoredProjects }` in the root
   build, or disable `apiCheck`/`apiDump` on it the way the samples do.
7. Add the module path to the `paths:` filter in `.github/workflows/publish.yml` when it publishes,
   and to the publish job's task list.

## Binary-compatibility baselines

`org.jetbrains.kotlinx.binary-compatibility-validator` 0.18.1 is applied at the root. Ten baselines
are checked in: `Source/api/Source.api`, `CodeGeneration/KSP/api/KSP.api`,
`GradlePlugin/api/GradlePlugin.api`, `Testing/api/Testing.api`, and one per integration. Root
configuration excludes `ContractTests` and the sample projects from validation.

The baseline is a reviewed record of the public ABI, not build noise:

1. `./gradlew apiCheck` fails. **Read the diff it prints.** It names the exact removed, added, or
   changed members.
2. Decide whether that change is intended. A removed or re-signed public member is a breaking change
   for Java and Kotlin consumers and needs a deliberate decision, not a regenerated file.
3. If it is intended, run `./gradlew apiDump` (or `:<Module>:apiDump`) and commit the updated `.api`
   file **in the same change** as the source change that caused it, so review sees both together.
4. If it is not intended, fix the source. A leaked `public` type, a widened return type, or an
   accidentally exposed internal is the bug — the baseline caught it.

Never run `apiDump` to make a red gate go green without first understanding the diff. `KSP.api`
contains only `ArcSymbolProcessorProvider`; keep everything else in that module `internal`.

## Publishing and versions

- Version comes from the `version` Gradle property, defaulting to `0.0.0-SNAPSHOT`
  (`providers.gradleProperty("version").getOrElse("0.0.0-SNAPSHOT")`). Release builds pass
  `-Pversion="$RELEASE_VERSION"`.
- `.github/workflows/publish.yml` verifies with `./gradlew clean build --no-configuration-cache`,
  runs the Chronicle real-kernel workflow, then publishes each module with
  `:<Module>:publishAndReleaseToMavenCentral`. Publication is signed and goes to the Central Portal.
- Gradle Plugin Portal publication is deliberately absent; the `io.cratis.arc` plugin marker is
  uploaded by the `:GradlePlugin` Maven Central task. Do not add `com.gradle.plugin-publish`
  unless asked.
- Release intent is label-driven. `.github/workflows/verify-semver-label.yml` enforces exactly one
  release-intent label on a pull request, and `publish.yml` fails a merge that publishes nothing
  unless the pull request carried `no-release`.
- Recognized Gradle properties in this repository: `version`, `useMavenLocal` (adds `mavenLocal()` in
  `settings.gradle.kts`), `chronicleVersion` (`:Integrations:Chronicle`), and `chronicleKernelImage`
  (`:ContractTests:chronicleRealKernelTest`, which requires an immutable `@sha256:` digest).

## Quality gates

| Gate | Command | What it proves |
| --- | --- | --- |
| Workspace | `./gradlew clean build --no-configuration-cache -x :ContractTests:typeScriptRuntimeTest` | Every module compiles with zero warnings, all JVM tests pass, `apiCheck` passes, sample proxy generation succeeds |
| Baselines | `./gradlew apiCheck` | No unreviewed public ABI drift in the ten baselined modules |
| Proxy determinism and strict TypeScript | `./gradlew :GradlePlugin:verifyContractTestProxyDeterminism :ContractTests:typeScriptBuild --no-configuration-cache` | A second generation changes no bytes, and the generated proxies compile strictly against the pinned `@cratis` packages |
| TypeScript runtime | `./gradlew :ContractTests:typeScriptRuntimeTest --no-configuration-cache` | The published clients drive the real Kotlin Spring Boot sample; exact TAP totals with zero failures |
| Documentation | `./Documentation/verify-markdown.sh` | Markdown lint, snippet validation, toc targets, and link checking over `Documentation/**` |
| Chronicle kernel (opt-in) | `./gradlew :ContractTests:chronicleRealKernelTest --no-configuration-cache` | Kotlin and Java Chronicle samples against a digest-pinned kernel in Docker |

`:ContractTests:check` depends on `typeScriptRuntimeTest`, which is why the workspace gate excludes
it with `-x` and CI runs it as a separate, time-boxed step. Run the excluded gate too before calling
work done.

## Standing prohibitions

- **Do not change dependency manifests, the Gradle wrapper, or `gradle.properties` unless explicitly
  asked.** That includes bumping a library version pinned as a `val` in a module build file, editing
  `gradle/wrapper/gradle-wrapper.properties`, and touching `ContractTests/TypeScript/package.json` or
  `package-lock.json`. This is a repository convention with real consequences: pinned versions are
  what make the contract gates reproducible.
- There is no Gradle version catalog in this repository — `gradle/` contains only the wrapper, and
  versions are declared as local `val` properties in each module build file. Do not introduce a
  catalog as a side effect of another change.
- Do not add a placeholder module, an empty publication, or a disabled task to make a gate pass.
- Do not weaken `allWarningsAsErrors`, `-Werror`, or a toolchain version in a module build file to
  work around a warning. Fix the warning.
- Do not make `:Source` depend on Spring Boot or Chronicle, and do not make `:GradlePlugin` depend on
  Spring Boot. Those directions are contract, not preference.

See [testing.md](./testing.md) for what runs inside those gates, [ksp.md](./ksp.md) for the
generation step the build depends on, and [typescript-proxies.md](./typescript-proxies.md) for the
proxy gates in detail.
