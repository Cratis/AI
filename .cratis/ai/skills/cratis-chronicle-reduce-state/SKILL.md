---
name: cratis-chronicle-reduce-state
description: Use when an event and previous state must be combined into a deterministic read model. Not for a side effect (use cratis-chronicle-react-to-fact).
compatibility: A supported application client and access to the intended kernel.
---

# Fold only what a projection cannot map

For a running balance, the first credit creates the balance and the next credit adds to it. Define both paths. The same ordered facts and instance key must always yield the same state. Do not read the clock, call a gateway, or consult mutable external state while folding.

- C# (`.csproj`): [fold state on the C# model](references/csharp.md).
- Node server (`package.json`): [bind the Node reducer class](references/typescript.md).
- Kotlin (`.kt`): [fold into a Kotlin copy](references/kotlin.md).
- Java (`.java`): [return the Java model from the handler](references/java.md).
- Go (`go.mod`): [register typed Go folds](references/go.md).
- Elixir (`mix.exs`): [return the next Elixir struct](references/elixir.md).
- Python has no released application client: [keep the fold in a supported service](references/python.md).

Exercise absent state, a subsequent update and any declared deletion separately. Replay the same inputs; compare the resulting fields and key. If replay changes the answer, fix the fold before replacing a stored view.
