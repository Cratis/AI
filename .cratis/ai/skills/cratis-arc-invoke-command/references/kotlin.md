# Execute through the command pipeline

Inject the host's `CommandPipeline`. In a suspending operation, pass the command and the `CommandExecutionOptions` supplied by the trusted host: the operation's correlation ID, authenticated `ArcPrincipal`, scoped `ServiceResolver` and applicable tenant ID and namespace. Never build those values from command input or call `handle` directly.

```kotlin
import io.cratis.arc.commands.CommandExecutionOptions
import io.cratis.arc.commands.CommandPipeline
import io.cratis.arc.results.CommandResult

suspend fun dispatch(
    pipeline: CommandPipeline,
    command: Any,
    options: CommandExecutionOptions,
    onAccepted: (Any?) -> Unit
): CommandResult<*> {
    val result = pipeline.execute(command, options)
    if (result.isSuccess) onAccepted(result.response)
    return result
}
```

A successful command may have no response. Preserve the result so the caller can distinguish refusal from success without a response. Chronicle constraint and concurrency refusals are validation findings (`constraintViolation` and `concurrencyViolation`), not exceptions: an unchanged request will not fix a uniqueness conflict. For stale state reload and re-decide rather than retrying blindly.
