---
name: cratis-arc-invoke-command
description: Use when a service or job must run an existing command through the command pipeline. Not for declaring a new handler (cratis-arc-declare-command).
---

# Dispatch from a trusted caller

1. Resolve `ICommandPipeline` from the host. In a request, preserve the existing scoped provider when the command must use the same identity, tenant and scoped dependencies. In a job, establish the job's permitted identity and tenant first; an absent HTTP caller does not grant privileges. **Done:** the fixture distinguishes the permitted caller from an insufficient caller before dispatch.
2. Await `pipeline.Execute(command, scopedProvider)` and inspect the returned `CommandResult`. Use the overload without a provider when a dedicated new service scope is intended or the operation must select an authentication scheme. Scheme-selected execution requires an Arc-owned fresh scope: do not reuse a provider already bound to a different principal or tenant. A typed response is meaningful only on a successful verdict. **Done:** failed authorization or validation is surfaced to the service without a success notification. `Validate` alone never executes the handler.
3. With a recording provider or isolated event store, dispatch invalid input, then a valid control. **Done:** the first receives a rejection and makes no write; the control records one write under the expected owner. Use `dotnet test` on the pipeline fixture. If the invalid case writes, check for a direct `Handle()` call before changing the validator. For the scenario harness hand both cases to [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md).
