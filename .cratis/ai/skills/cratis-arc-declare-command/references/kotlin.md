# Declare the handler and return its outcome in Kotlin

Declare `@Command` on a data class; KSP generates the adapter. Put `@CommandKey` on the property that addresses the history. Resolve dependencies as handler parameters rather than deserializing a repository from the request. For a state-dependent decision, provide the state once and consume the supplied value in `handle`; don't query a second time after deciding which version to protect.

```kotlin
@Command
data class RenameTask(@CommandKey val id: String, val title: String, val expected: Long) {
    fun handle(current: TaskView): EventsWithConcurrencyScopes =
        EventsWithConcurrencyScopes.builder()
            .event(id, TaskRenamed(current.title, title))
            .expectedSequenceNumber(id, expected)
            .build()
}
```

Return this outcome to the Chronicle integration; do not append separately. `@CommandEventSourceType` names the source type, `@CommandEventStreamId` names the stream and `@CommandEventSubject` sets the subject. Test a stale sequence: no rename should be appended.

Declare a single key: a constructor key plus a body key is rejected at compile time (`ARCKSP0106`), not combined. Use `commandProvidedValuesOf` to pass prepared values to the handler. An `EventForEventSourceId` routes an individual returned event to a different history. Keep the event and caller response distinct when the handler returns both; a response is not another event to append.

Use a `Pair` for two outputs together, `ArcOneOf` for alternative outcomes. Diagnose KSP findings before changing HTTP routing: `ARCKSP0100` warns about a missing command annotation, `0101` rejects an unsupported declaration, `0106` rejects ambiguous keys and `0110` rejects invalid event metadata.
