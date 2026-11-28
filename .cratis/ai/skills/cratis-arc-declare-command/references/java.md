# Declare the handler and return its outcome in Java

Place a `@Command` record in the owning feature. The generated adapter binds its components from the payload and resolves service parameters for its public `handle` method. For a service-backed write:

```java
@Command
public record CreateTask(String title) {
    public CompletionStage<TaskCreated> handle(TaskStore repository) {
        var task = repository.create(title);
        return CompletableFuture.completedFuture(new TaskCreated(task.id(), task.title()));
    }
}
```

Keep asynchronous work in the returned stage; the adapter waits for it. For a Chronicle-backed decision, **return** the event instead of writing it in the repository. Put `@CommandKey` on the record component that owns the history, or implement `CommandKeyProvider` with `public Object commandKey()` returning the selected key.

If the decision depends on a particular observed position, return `CompletionStage<EventsWithConcurrencyScopes>` and build the outcome with `EventsWithConcurrencyScopes.builder().event(id, event).expectedSequenceNumber(id, expected).build()`. Set `@CommandEventSourceType("Task")`, `@CommandEventStreamId("rename-stream")` or `@CommandEventSubject("task-owner")` on the record only when the event needs those metadata.

For an alternate event target construct `new EventForEventSourceId(otherId, event)` rather than changing the entire command key. Keep a provision step in a public `provide` method when state is needed before handling; consume the prepared value without reading it again.

Use `CommandProvidedValues.of(first, second)` when `provide` returns multiple values. Each assignable handler parameter consumes its match once. With Chronicle installed a `Pair<AuthorId, AuthorRegistered>` can carry the response ID and event together: `return new Pair<>(id, new AuthorRegistered(name));`. The caller receives the ID; verify the event separately.

## Return a collection of events

Return `List.of(new TaskRenamed(previousTitle, title), new TaskRenamed(previousCopyTitle, title))` to target the record's `@CommandKey` for both events, or wrap an event with `new EventForEventSourceId(copyId, event)` to target a different history. A mixed plain/routed list must contain only events; a non-event member makes it invalid, with no partial append.

With the Chronicle transaction installed, awaited nested commands stage events under the outer command. Only outer success commits them; refusal or failure in either command discards the staged batch. A `constraintViolation` names a business constraint; a `concurrencyViolation` means the expected history position was stale.
