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

## Prove the outer commit boundary

Execute an outer command through the Chronicle-enabled pipeline. Have it await a child that stages an event under another ID, then return an outer event. Assert both histories advanced. Repeat with either the child or the outer command refusing, and assert neither history advanced, even if the outer handler ignored the child's unsuccessful result. Include an invalid mixed plain/routed batch and verify no event from that batch was persisted.
