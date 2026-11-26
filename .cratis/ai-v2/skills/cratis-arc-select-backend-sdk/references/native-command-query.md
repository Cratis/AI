# Prove the dispatch path

| Requested surface | What has to execute |
| --- | --- |
| In-process command response | Register the command in the language's registry; dispatch through its pipeline and inspect success and the typed response. Calling the handler directly bypasses registration. |
| HTTP command or query | Start the native host on loopback and use its documented route. Inspect the status **and** the native result envelope; an in-process reply does not establish serialization. |
| Validation | Dispatch invalid input and inspect the affected member and absence of the forbidden effect. A shared wire shape does not install a validator. |

For JVM requests match the caller language: a Kotlin implementation test is insufficient for Java discovery or a Java-callable asynchronous signature. For Node distinguish a backend package from a browser client with a similar name. For Elixir require the released module/function and a consuming Mix test before promising a handler or query. If the evidence stops at a declaration, report that limit instead of writing a guessed adapter.
