# Attach the position used by the Node decision

If the rule depends only on one existing source, read its relevant history and retain the actual position from that read as a `bigint`. Append to the same source and sequence:

```ts
const result = await sequence.append(bookId, borrowed, {
    concurrencyScope: { eventSourceId: true, sequenceNumber: observedPosition }
});
```

Inspect the append result, not just promise resolution. A matching event after that position must refuse the write. Do not sample a fresh tail after deciding: that could admit a change you never evaluated. This explicit scope does not infer other reads. For multiple dependencies or a missing history you cannot guard exactly, use a guarded decision host rather than substituting zero.
