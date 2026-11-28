# Register Java event and batch handlers

In an `@Reactor(id = "book-index")` class a per-event method can receive `(BookStored event, EventContext context)`. For a batch, declare the event types with repeatable `@Observes(BookAdded.class)` and `@Observes(BookRemoved.class)` annotations on the batch method. Iterate its `EventBatch`; use each entry's own event and context instead of attributing the page to the first source.

If one entry is throttled, `batch.defer(entry.getContext(), Duration.ofSeconds(1))` identifies the partition to retry. Do not acknowledge an external effect until its receiver has accepted the same stable receipt on every attempt. For future-only effects use `@StartAtTail` as well as replay exclusion with `@OnceOnly`; neither is retry deduplication.
