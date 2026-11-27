# Load the Kotlin protocol descriptor

In a Kotlin/JVM Gradle application using JDK 17, add Maven Central and the contracts dependency to `build.gradle.kts`:

```kotlin
repositories { mavenCentral() }
dependencies { implementation("io.cratis:chronicle-contracts:19.184.3") }
```

In `src/main/kotlin/Main.kt`:

```kotlin
import io.cratis.chronicle.contracts.ChronicleDescriptorSet

fun main() {
    check(ChronicleDescriptorSet.bytes.isNotEmpty())
    println(ChronicleDescriptorSet.bytes.size)
}
```

With the Gradle `application` plugin and `application { mainClass.set("MainKt") }`, `./gradlew run` prints a positive descriptor byte count. If the resource is missing, inspect the runtime JAR before opening a connection. Check the resolved Maven coordinate for the version; the manifest need not declare an implementation version. Generated coroutine stubs are wire APIs, not the annotated `io.cratis:chronicle` application client.
