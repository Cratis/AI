# Append from a Kotlin coroutine

Include the event type in registration. In a coroutine, append through the scoped store:

```kotlin
import io.cratis.chronicle.IEventStore
import io.cratis.chronicle.events.EventType

@EventType(id = "author-registered")
data class AuthorRegistered(val name: String)

suspend fun registerAuthor(store: IEventStore, authorId: String, name: String) =
    store.eventLog.append(authorId, AuthorRegistered(name))
```

Inspect the returned `result.isSuccess` before publishing success to the caller. The source ID passed to append, not a similarly named payload field, selects the history.

Without an explicit event ID the class simple name is used. Two packages can have the same simple name. Preserve the deployed ID when moving the class. A failed append can report constraint or concurrency violations: inspect which rule refused before deciding whether to reevaluate.
