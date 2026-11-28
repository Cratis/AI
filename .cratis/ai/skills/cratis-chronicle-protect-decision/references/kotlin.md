# Pass an explicit scope to the suspending append

For a decision based only on an existing source, retain the actual `EventSequenceNumber` from its read. Append a registered event in the same sequence:

```kotlin
import io.cratis.chronicle.eventSequences.AppendOptions
import io.cratis.chronicle.eventSequences.EventSequenceNumber
import io.cratis.chronicle.eventSequences.IEventSequence
import io.cratis.chronicle.eventSequences.concurrency.ConcurrencyScope

suspend fun appendBorrowed(
    sequence: IEventSequence,
    bookId: String,
    borrowed: Any,
    observedPosition: EventSequenceNumber
) = sequence.append(
    bookId,
    borrowed,
    AppendOptions(concurrencyScope = ConcurrencyScope(observedPosition, eventSourceId = true))
)
```

Inspect the result after racing a second append to that book. For an absent source, express “expects no matching event” separately from a concrete position; `ConcurrencyScope.none` disables the check. If dependencies extend beyond what the scope covers, do not claim inferred enrollment. Move the decision and its append together to a guarded host.
