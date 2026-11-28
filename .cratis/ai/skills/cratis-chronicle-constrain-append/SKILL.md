---
name: cratis-chronicle-constrain-append
description: Use when enforcing or releasing a uniqueness claim at Chronicle append time across competing writers. Not for protecting a decision over previously read state (use cratis-chronicle-protect-decision).
compatibility: A supported application client and access to the intended kernel.
---

# Enforce uniqueness where the competing writes commit

Name the claim, the event fields it covers, the comparison rules and the event that releases it. A preflight query can improve feedback but cannot reserve a value. Register the constraint before accepting writes.

- C# (`.csproj`): [define the C# claim and removal event](references/csharp.md).
- Node server (`package.json`): [define the Node constraint](references/typescript.md).
- Kotlin (`.kt`): [define the Kotlin rule](references/kotlin.md).
- Java (`.java`): [name the Java properties explicitly](references/java.md).
- Go (`go.mod`): [build and register the Go constraint](references/go.md).
- Elixir (`mix.exs`): [declare the Elixir constraint module](references/elixir.md).
- Python has no released application client: [keep the claim in the owning service](references/python.md).

In a disposable namespace claim the same value from two different sources. Inspect the named collision and confirm the refused source gained no event. Then release the original claim using the declared removal event and prove the second source can acquire it. During an index rebuild, wait for readiness rather than disabling uniqueness.
