# Select the JVM client from Java

Use the `io.cratis:chronicle` application artifact, for example `implementation 'io.cratis:chronicle:7.13.0'` in a Gradle Groovy build. In a Java worker with development options, select the blocking facade:

```java
try (var client = BlockingChronicleClient.connect(ChronicleOptions.development())) {
    // Exercise the worker's operation in a disposable namespace.
}
```

Compile against the client, then run against a development kernel. If the build exposes only generated messages, check the artifact: the contracts jar is not the blocking facade. A successful compile alone does not verify the deployed client/kernel pair.
