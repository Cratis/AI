---
name: cratis-specifications-exercise-backend
description: Use when a backend author needs to check which event an Arc command appends, why it refuses input, or which row Chronicle projects. Not for a decision invoked without the pipeline (use cratis-specifications-isolate-behavior).
compatibility: Requires the test runner the application already uses and the Arc or Chronicle testing package released for its SDK, at the versions the application references.
---

# Test the backend promise at its owner

Pick the harness by the guarantee the spec has to prove, not by the artifact's name:

- **Pipeline scenario (default).** Use it for authorization, validation and command or query outcomes exercised by the selected SDK. A recorded append proves what the command tried to write, not that a kernel would accept it.
- **Model or reaction scenario.** Where the SDK provides one, use it to check the row a projection or reducer produces, or the effect a reactor returns, from given events.
- **Running kernel or HTTP host.** Use a kernel for persistence, discovery, delivery, or any store guarantee the SDK substitute omits, such as constraint or concurrency enforcement. Use a hosted HTTP request for transport binding: passing a typed argument to the pipeline does not test JSON binding.

A decision that can be invoked directly without the pipeline needs none of these.

Commit one spec per uncovered consequential rule, and add the accepted case only when the handler decides something. See the case defaults under "Verify what can go wrong" in the `general` rule; do not repeat a decision that a direct spec already covers.

## Write the spec

1. Seed only the history or state the rule depends on, before the action. Seed an unrelated record as well when the spec must tell earlier history from this command's work.
2. Act once.
3. On refusal, assert the specific reason (the rule, member, constraint or authorization). For an event-writing command also assert that nothing was appended. A refusal alone passes when the caller was unauthorized or a required read model was missing, so the rule under test may never have run.
4. For an accepted event-writing command, assert the event, source and values. For a response-only command or query, assert the promised response fields or rows instead.
5. Await every assertion that returns a task, future or promise. Otherwise the runner can finish before a failing assertion completes.
6. For delivery, wait on the completion signal the SDK returns, never on a fixed sleep: a sleep cannot tell a slow observer from a failed one.

The spec is done when it fails after the rule is removed and passes when the rule is restored.

## Read the reference for the application's SDK

Each reference names the packages, one worked example and the limits of that SDK's harness. Read only the one for the artifact in the application, and do not adapt another language's reference: the scenario APIs differ.

| Artifact | Read |
| --- | --- |
| `*.csproj`, `*.cs` | [references/csharp.md](references/csharp.md) |
| Node server `package.json`, `*.ts` | [references/typescript.md](references/typescript.md) |
| `*.kt` | [references/kotlin.md](references/kotlin.md) |
| `*.java` | [references/java.md](references/java.md) |
| `go.mod`, `*.go` | [references/go.md](references/go.md) |
| `mix.exs`, `*.ex` | [references/elixir.md](references/elixir.md) |

For C#, read one more reference only when its condition holds:

- [references/csharp-command-results.md](references/csharp-command-results.md): the spec asserts why a command was refused, which events it appended, or needs a caller, a seeded read model or a generated value.
- [references/csharp-decision-reads.md](references/csharp-decision-reads.md): the command claims uniqueness or guards against a concurrent writer.
- [references/csharp-query-scenario.md](references/csharp-query-scenario.md): the promise belongs to a query, including an observable one.
- [references/csharp-integration.md](references/csharp-integration.md): the promise is an append contract, a projected or reduced row, a reactor's effect, or needs a running store.

Python has no released application SDK or testing package, so no Python scenario exists. Test that boundary through a service written with a supported SDK; do not rebuild a harness from generated contracts.

A React component that renders the result is a different task from a Node server; this skill does not cover it.
