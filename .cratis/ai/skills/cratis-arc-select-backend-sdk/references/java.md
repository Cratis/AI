# Java: create a task in Spring Boot

For a Gradle Spring MVC module with `src/main/java`, keep the command as a Java record. Use JDK 17 and keep generated Kotlin adapter compilation enabled; the Java types must be available before the adapters compile. Start with the in-memory profile; Chronicle is a separate integration, not required to return a task.

Clone `https://github.com/Cratis/Arc.Kotlin.git` at `v7.11.1` and from its root run `./gradlew :Samples:Java:SpringBoot:bootRun`. `@Command` marks a record. Its `handle(TaskStore repository)` returns a `CompletionStage<TaskCreated>`; the generated adapter invokes it.

In a second terminal:

```sh
curl -sS localhost:8080/api/create-task -H 'Content-Type: application/json' -d '{"title":"Try Arc"}'
curl -sS -X QUERY localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{"arguments":{}}'
```

Expect the created task ID and title in `response`, then the same task in `data`. These routes are configured for the samples' packages. If the route is missing in your app, check the generated manifest and endpoint options before changing the payload.
