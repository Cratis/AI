# Append through the Java facade

Declare a Java record `@EventType(id = "author-registered") public record AuthorRegistered(String name) {}` in its own file and register it. On the blocking store, `var result = store.getEventLog().append(authorId, new AuthorRegistered(name));`. Inspect the outcome before using `result.getSequenceNumberValue()` as a position. Do not call suspend APIs or invent a position when transport fails.

## Append through a declared event source

Use kernel 19.30.0 or later. Include the definition in artifact discovery:

```java
import io.cratis.chronicle.eventSources.ConcurrencyDimension;
import io.cratis.chronicle.eventSources.EventSource;
import io.cratis.chronicle.eventSources.EventStream;

@EventSource(name = "Account", description = "Bank account",
    concurrency = {ConcurrencyDimension.EventSourceId, ConcurrencyDimension.EventStreamType},
    streams = {@EventStream(name = "Transactions", description = "Account movements")})
class AccountEventSource {}
```

Build options with `new AppendOptionsBuilder().throughEventSource(AccountEventSource.class, "Transactions").build()` (from `io.cratis.chronicle.java`) and pass them to `sequence.append(accountId, deposited, options)`. The named stream is validated. A contradictory explicit route fails the whole append, including a multi-entry batch. Unless an explicit concurrency scope is supplied, the declared dimensions narrow the tail that is read and checked. Verify that the event lands in the declared stream and a batch containing a contradictory route appends nothing.
