# Select the Kotlin store

Construct `val client = ChronicleClient(options)` and `val store = client.getEventStore("library", "test")`. Restrict discovery to the application artifacts. Use `ChronicleOptions.development()` only with a local development kernel. Check the store by performing a bounded operation from a coroutine; printing `store.name` is not proof of readiness. Call `client.dispose()` on shutdown. Do not copy Node credentials into this client: the connection rejects `apiKey` even though the connection-string parser recognizes it.

The constructor starts the connection; it does not establish that all store artifacts have registered. `skipTlsValidation` defaults to true: set it to false for shared deployments and validate the certificate chain. For a plain client narrow discovery with `withArtifactsFrom("com.example.library")`. In the Spring starter use `cratis.chronicle.artifact-packages`; do not assume servlet web auto-configuration applies to a reactive host.
