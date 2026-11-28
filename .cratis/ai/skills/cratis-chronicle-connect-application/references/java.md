# Own the Java blocking client

In a local check use `try (var client = BlockingChronicleClient.connect(ChronicleOptions.development())) { var store = client.getEventStore("library", "test"); /* check a registered event */ }`. Put the actual read or append inside the resource lifetime. Use production connection options for a shared kernel; do not invoke the underlying Kotlin suspend methods from Java.
