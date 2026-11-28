# Select the Kotlin application artifact

For a Kotlin service that appends from a coroutine, add the Chronicle application artifact to the service's Gradle dependencies. For example:

```kotlin
implementation("io.cratis:chronicle:7.13.0")
```

Resolve dependencies and compile the service. The compile classpath should include the application client and its contracts. If only `chronicle-contracts` appears, fix the direct dependency: generated messages do not provide the suspending event-sequence append API. Before rollout, check the append result in a disposable namespace on the intended kernel.
