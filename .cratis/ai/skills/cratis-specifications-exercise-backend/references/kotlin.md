# Exercise a Kotlin backend

Use `io.cratis:arc-testing` for pipeline behavior. Pass the application's generated artifact module to the scenario; calling the handler directly skips validation and authorization. From a suspend test body:

```kotlin
val result = CommandScenario(module, RegisterBook::class.java)
    .execute(RegisterBook(BookId("book-1"), ""))
result.shouldBeInvalid()
result.shouldHaveValidation(member = "title")
```

Use the member reported by the application's validator. For a command that reads a model, arrange it with `withReadModelForKey` before `execute`. `QueryScenario` exercises a snapshot query; `ObservableQueryScenario` collects bounded emissions.

Use `io.cratis:chronicle-testing` for an append or reducer instead: pass `EventScenario().eventLog` to the writer and assert `shouldHaveAppended<T>(sourceId)` on the scenario. `ReadModelScenario<Model>(reducer).fold(sourceId, event)` returns the reduced state. The in-memory append records the event and returns success with no constraint violations; it cannot prove that a conflicting write is refused. The model scenario folds a reducer, not a projection, and there is no reactor scenario. Use a running kernel for constraints, projection execution, reactor dispatch or observer delivery.
