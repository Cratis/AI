# JVM: create a task in Spring Boot

Use JDK 17 and the Gradle 8.14.6 wrapper. In a consumer project resolve the `io.cratis.arc` plugin from Maven Central and reference `io.cratis:arc-spring-boot-starter:7.11.1` with the same plugin version. Java models also use generated Kotlin adapters; keep the plugin's Kotlin and KSP versions.

For an already configured local host, run `git clone --branch v7.11.1 --depth 1 https://github.com/Cratis/Arc.Kotlin.git`, then `cd Arc.Kotlin`. Start **one** language's sample:

- Kotlin: `./gradlew :Samples:Kotlin:SpringBoot:bootRun`. `@Command` marks a data class. Its `public fun handle(repository: TaskRepository): Pair<TaskCreated, TaskCreationHandled>` calls `repository.create(title)`.
- Java: `./gradlew :Samples:Java:SpringBoot:bootRun`. `@Command` marks a record. Its `handle(TaskStore repository)` returns a `CompletionStage<TaskCreated>`; the generated adapter invokes it.

Both samples use the in-memory profile by default. In a second terminal:

```sh
curl -sS localhost:8080/api/create-task -H 'Content-Type: application/json' -d '{"title":"Try Arc"}'
curl -sS -X QUERY localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{"arguments":{}}'
```

Expect the created task ID and title in `response`, then the same task in `data`. These routes are configured for the samples' packages. If the route is missing in your app, check the generated manifest and endpoint options before changing the payload.
