---
name: cratis-chronicle-evolve-event
description: Use when changing a stored event shape while old history and older readers must remain usable. Not for changing a relational schema (use cratis-arc-migrate-relational-schema).
compatibility: A supported application client and access to the intended kernel.
---

# Preserve the meaning of a stored generation

Keep the deployed event type ID. Give the changed shape its own generation and retain the previous shape. Specify both mappings; a split or default is not automatically reversible. Do not rewrite old history to make a current reader pass.

- C# (`.csproj`): [define the C# migration](references/csharp.md).
- Node server (`package.json`): [register the Node target/source pair](references/typescript.md).
- Kotlin (`.kt`): [map properties with Kotlin references](references/kotlin.md).
- Java (`.java`): [map the Java class pair](references/java.md).
- Go (`go.mod`): [register adjacent Go generations](references/go.md).
- Elixir (`mix.exs`): [declare both Elixir directions](references/elixir.md).
- Python has no released application client: [keep generation mapping in the producer boundary](references/python.md).
- [deployed readers](references/deployed-readers.md)

Store an old-generation example before introducing the new mapping. Check an upcast read, delivery to a reader pinned to the earlier shape, and replay across the boundary. Readiness to serve migrated history is not the same as accepting registration. If no mapping preserves required business meaning, stop for a contract decision.
