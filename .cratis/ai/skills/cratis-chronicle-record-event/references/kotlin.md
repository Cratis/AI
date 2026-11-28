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

## Append through a declared event source

Use kernel 19.30.0 or later. Include the definition in artifact discovery:

```kotlin
import io.cratis.chronicle.eventSources.ConcurrencyDimension
import io.cratis.chronicle.eventSources.EventSource
import io.cratis.chronicle.eventSources.EventStream
import io.cratis.chronicle.eventSequences.appendThroughEventSource

@EventSource(
    name = "Account", description = "Bank account",
    concurrency = [ConcurrencyDimension.EventSourceId, ConcurrencyDimension.EventStreamType],
    streams = [EventStream("Transactions", "Account movements")]
)
class AccountEventSource
```

In a suspend function call `eventLog.appendThroughEventSource(AccountEventSource::class, accountId, deposited, eventStream = "Transactions")`. The named stream is validated. A contradictory explicit route fails the whole append, including a multi-entry batch. Unless an explicit concurrency scope is supplied, the declared dimensions narrow the tail that is read and checked. Verify that the event lands in the declared stream and a batch containing a contradictory route appends nothing.
