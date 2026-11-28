# Expose a finite query before making it live

Put query functions in the companion object of a `@ReadModel` data class. Use `@JvmStatic`; `@FromServices` parameters are resolved by the host rather than bound from the caller. For example `fun all(@FromServices repository: TaskRepository): List<TaskView> = repository.all()`. Use `Flow<List<TaskView>>` for later snapshots. Avoid overloads and instance methods. A Kotlin default applies on omission, not when the caller explicitly supplies null.

Use GET for scalar arguments and HTTP QUERY for structured inputs. Keep `page`, `pageSize`, `sortBy`, `sortDirection` for query options; `@QueryHttpMethod` expresses a proxy preference. If the source is RxJava 3, include the RxJava adapter at runtime.
