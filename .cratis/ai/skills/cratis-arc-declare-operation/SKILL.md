---
name: cratis-arc-declare-operation
description: Use when a developer needs an Arc command to call an external provider before it commits, with a way to undo that call if the command fails. Not for work after commit (use cratis-chronicle-react-to-fact).
compatibility: Requires an Arc backend whose SDK supports command operations.
---

# Run provider work before a command commits

Choose a command operation when provider work must run before the [command](../cratis-arc-declare-command/SKILL.md) commits. The handler returns an immutable description of the work; Arc runs it and can run its compensation if the command fails without committing. Give both the same caller-supplied identifier, so a repeated attempt does not act twice and compensation can find its own work, including when the provider accepted the call but its acknowledgement was lost.

Use one operation per provider action. Work that cannot be undone, such as sending mail, belongs in [a reactor on the committed fact](../cratis-chronicle-react-to-fact/SKILL.md), deduplicated by the same identifier.

## Read the reference for the host

For a command in a `*.csproj`, read [C#](references/csharp.md); for a Node server package, read [TypeScript](references/typescript.md); for a `go.mod` server, read [Go](references/go.md).

Kotlin, Java and Elixir have no verified returned-operation runner. If delivery after commit is acceptable, record a durable fact and process it idempotently. If the contract requires compensation before commit, put the command in a supported host. [Python](references/python.md) callers should invoke that service over HTTP, not simulate rollback locally.

## Expected outcome

In a pipeline scenario, make the provider call fail after it may have been accepted. The compensation receives the same identifier and the result still reports the original failure.

## Stop when

- **Commit is unknown or mixed:** reconcile the event and provider state before reversing anything. A failed response is not proof that nothing committed.
- **A committed outcome is wrong:** use [a corrective fact](../cratis-chronicle-evolve-event/SKILL.md) instead of compensating.

## Avoid

- Do not generate the identifier or call the provider in the handler.
- Do not track success with a mutable flag or undo in a catch block. Let Arc decide recovery from the commit outcome.

## Related skills

- [Declare a command](../cratis-arc-declare-command/SKILL.md)
- [React after commit](../cratis-chronicle-react-to-fact/SKILL.md)

For Elixir callers, read the [service boundary](references/elixir.md).

For Java callers, read the [service boundary](references/java.md).

For Kotlin callers, read the [service boundary](references/kotlin.md).
