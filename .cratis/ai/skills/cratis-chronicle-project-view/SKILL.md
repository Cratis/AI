---
name: cratis-chronicle-project-view
description: Use when projecting events into a keyed view with declarative field mappings, counters, removal or graph relationships. Not for calculations that require a custom fold (use cratis-chronicle-reduce-state).
compatibility: A supported application client and access to the intended kernel.
---

# Choose the key before mapping the fields

Choose the instance key and which event creates, changes or removes that instance. Start with a model-bound mapping; use a builder when a join, nested child or explicit key cannot be expressed there. A projection ID already in use is a deployed identity. Preserve it when changing declaration style.

- C# (`.csproj`): [map a C# view and check instance identity](references/csharp.md).
- Node server (`package.json`): [map fields on the Node model](references/typescript.md).
- Kotlin (`.kt`): [map the Kotlin model](references/kotlin.md).
- Java (`.java`): [declare the Java model mapping](references/java.md).
- Go (`go.mod`): [bind and register the Go projection](references/go.md).
- Elixir (`mix.exs`): [map the Elixir read model](references/elixir.md).
- Python has no released application client: [read the view through its owner](references/python.md).

Read by key before the first event, after creation and after a replay. Use at least two keys: correct fields stored under one constant key are still wrong. A join needs a matching key, not just matching property names. Treat removal and a missing result explicitly. For a relationship store, see graph projections in the [C#](references/csharp.md#graph-projections) or [Elixir](references/elixir.md#graph-projections) reference. A stored view may lag; a passive inline read is not proof the stored view is current.
