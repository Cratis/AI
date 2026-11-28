# Fold into a Kotlin copy

In an `@Reducer` class implement a typed method such as `fun employeeHired(event: EmployeeHired, state: EmployeeState?, context: EventContext): EmployeeState`. Return `(state ?: EmployeeState()).copy(id = context.eventSourceId, title = event.title)` for a model with those defaults. An empty ID can collapse several employees into one sink entry. Do not discard previously folded fields on an update.

The reducer executes in the client, not in the kernel projection engine. Check that the correct worker is running and registered before diagnosing a stale reducer result as missing history.
