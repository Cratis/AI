# Pass an explicit scope to the suspending append

For a decision based only on an existing source, retain the actual `EventSequenceNumber` from its read. Append in the same sequence:

```kotlin
val scope = ConcurrencyScope(observedPosition, eventSourceId = true)
val result = sequence.append(bookId, borrowed, AppendOptions(concurrencyScope = scope))
```

Inspect the result after racing a second append to that book. For an absent source, express “expects no matching event” separately from a concrete position; `ConcurrencyScope.none` disables the check. If dependencies extend beyond what the scope covers, do not claim inferred enrollment. Move the decision and its append together to a guarded host.
