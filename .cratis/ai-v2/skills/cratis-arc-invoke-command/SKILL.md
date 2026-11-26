---
name: cratis-arc-invoke-command
description: Use when a service or job must run an existing command through the command pipeline. Not for declaring a new handler (cratis-arc-declare-command).
compatibility: Requires the .NET SDK.
---

# Dispatch from a trusted caller

1. Resolve `ICommandPipeline` from the host. In a request, preserve the existing scoped provider when the command must use the same identity, tenant and scoped dependencies. In a job, establish the job's permitted identity and tenant first; an absent HTTP caller does not grant privileges. **Done:** the scenario distinguishes the permitted caller from an insufficient caller before dispatch.
2. Await `pipeline.Execute(command, scopedProvider)` and inspect the returned `CommandResult`. A typed response is meaningful only on a successful verdict. **Done:** failed authorization or validation is surfaced to the service without a success notification. `Validate` alone never executes the handler.

```csharp
public sealed class KeepDispatcher(ICommandPipeline pipeline)
{
    public Task<CommandResult> Dispatch(Keep command, IServiceProvider requestServices) =>
        pipeline.Execute(command, requestServices);
}
```

3. With a recording provider or isolated event store, dispatch invalid input, then a valid control. **Done:** the first receives a rejection and makes no write; the control records one write under the expected owner. Run `dotnet test -c Release` in the application's pipeline-spec project to verify both outcomes. If the invalid case writes, check for a direct `Handle()` call before changing the validator. For the scenario harness hand both cases to [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md).
