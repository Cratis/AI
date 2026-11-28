---
name: cratis-arc-select-backend-sdk
description: Use when a developer needs to choose an Arc backend or run a native command in Node, Kotlin, Java, Elixir or Go. Not for the Chronicle client lifecycle (use cratis-chronicle-select-client).
compatibility: Requires the toolchain for the selected host.
---

# Choose the backend that owns the request

Use the language and host of the service that owns the feature. Prove the command with its native dispatcher before integrating a browser client. A compatible HTTP envelope doesn't make .NET attributes, dependency injection or commit semantics portable.

Read only the reference for the service being changed: `.csproj` → [C#](references/csharp.md); Node server `package.json` → [TypeScript](references/typescript.md); `.kt` → [Kotlin](references/kotlin.md); `.java` → [Java](references/java.md); `go.mod` → [Go](references/go.md); `mix.exs` → [Elixir](references/elixir.md). Python has no released Arc application SDK; call the owning service over HTTP instead.

## When a client must work with two services

Check an authorized success and an invalid or unauthorized request on **each** host. Compare the generated route, payload, casing, validation fields and result. Only call `/validate` if the host advertises that route. A successful native reply is neither an HTTP compatibility test nor proof of a durable append. If the feature requires durable storage, [select a Chronicle client](../cratis-chronicle-select-client/SKILL.md) and verify the write separately.
