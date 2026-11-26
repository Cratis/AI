# Use the first missing observation

| Read-only evidence for the same scoped request | Next question |
| --- | --- |
| Command refused, no fact | Was that the specified refusal? Stop tracing it as slow delivery. |
| Fact present; observer checkpoint below its position | Does catch-up move the checkpoint for this partition? A global event count is not that checkpoint. |
| Checkpoint past the fact; view missing or wrong | Was this event included in the mapping, and was the view read by the expected source key? A moving position need not mean a row was created. |
| View correct; query omits row | Compare the same actor, scope, filters and page against the fresh query before investigating transport. |
| Fresh query includes row; subscription or screen remains stale | Inspect delivery to the client, then binding/render. Do not restart or rewind the observer. |

The fixture has only one source and partition. Chronicle's `ObserverInformation.LastHandledEventSequenceNumber` belongs to the observer, not a per-partition receipt. On a multi-partition capture, correlate scoped partition failures and the keyed view separately; an aggregate position cannot certify that a particular row was processed.

If the time window ends before the next checkpoint sample, report the interval as unknown. An old timestamp cannot distinguish a stopped observer from an idle one with nothing to consume.
