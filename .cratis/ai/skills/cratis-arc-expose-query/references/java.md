# Expose a finite query before making it live

Annotate the record `@ReadModel` and put public static queries on it. Distinguish caller arguments from injected services:

```java
@Path("/api/tasks")
public static TaskView[] all(@FromServices TaskStore repository) {
    return repository.all().toArray(TaskView[]::new);
}
```

For an asynchronous keyed lookup return `CompletionStage<TaskView>`; do not promise Kotlin-style default arguments on a Java record. For later snapshots return `Flow.Publisher<List<TaskView>>` from `java.util.concurrent.Flow`. A completed future of one array is not a stream. Test the finite response and a later publisher emission separately.

Use `@QueryHttpMethod(QueryHttpMethodType.QUERY)` to select the generated client's method for structured arguments. Use `ObservableState` for replayable current state; a `SubmissionPublisher` does not retain an initial snapshot for later subscribers. An RxJava 3 source needs its matching runtime adapter.
