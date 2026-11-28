# Kotlin: create a task in Spring Boot

For a Kotlin/JVM Spring Boot module use JDK 17. The sample pairs Kotlin Spring plugin 2.4.20 with Spring Boot 4.1.2 and generates adapters with KSP. Start with the in-memory profile; Chronicle is a separate integration, not required to return a task.

Clone `https://github.com/Cratis/Arc.Kotlin.git` at `v7.11.1` and from its root run `./gradlew :Samples:Kotlin:SpringBoot:bootRun`. `@Command` marks a data class. Its `public fun handle(repository: TaskRepository): Pair<TaskCreated, TaskCreationHandled>` calls `repository.create(title)`.

In a second terminal:

```sh
curl -sS localhost:8080/api/create-task -H 'Content-Type: application/json' -d '{"title":"Try Arc"}'
curl -sS -X QUERY localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{"arguments":{}}'
```

Expect the created task ID and title in `response`, then the same task in `data`. These routes are configured for the samples' packages. If the route is missing in your app, check the generated manifest and endpoint options before changing the payload.
