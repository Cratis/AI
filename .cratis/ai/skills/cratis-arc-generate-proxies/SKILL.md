---
name: cratis-arc-generate-proxies
description: Use when generating TypeScript clients from Arc server contracts or diagnosing a stale proxy. Not for consuming a generated hook.
---

# Generate and verify the contract

Generate from the server that owns the command or query. Use its registration and route settings, not the language of the consuming UI.

- For an ASP.NET Core project, read [C#](references/csharp.md).
- For a TypeScript package, read [TypeScript](references/typescript.md).
- For a Kotlin module, read [Kotlin](references/kotlin.md).
- For a Java module, read [Java](references/java.md).
- For a Mix application, read [Elixir](references/elixir.md).

No separately tagged Go generator module or Python Arc application generator is verified. Maintain an HTTP client against the service contract rather than installing a tool from an unrelated module tag.

Regenerate after renaming a contract, compile the consumer, and call one real endpoint. A successful build with a wrong route is not a passing check.
