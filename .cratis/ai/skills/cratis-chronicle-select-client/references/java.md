# Select the JVM client from Java

Use the `io.cratis:chronicle` application artifact, for example `implementation 'io.cratis:chronicle:7.13.0'` in a Gradle Groovy build. In a Java worker with development options, select the blocking facade:

```java
import io.cratis.chronicle.ChronicleOptions;
import io.cratis.chronicle.java.BlockingChronicleClient;

class CheckChronicleClient {
    public static void main(String[] args) {
        try (var client = BlockingChronicleClient.connect(ChronicleOptions.development())) {
            System.out.println(client.getEventStores());
        }
    }
}
```

Compile against the client, then run against a development kernel and check that the expected event store is listed. If the build exposes only generated messages, check the artifact: the contracts jar is not the blocking facade. A successful compile alone does not verify the deployed client/kernel pair.
