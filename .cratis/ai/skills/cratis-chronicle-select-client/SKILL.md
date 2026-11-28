---
name: cratis-chronicle-select-client
description: Use when choosing a Chronicle dependency for an application or a protocol inspection tool. Not for choosing an HTTP command or query host (use cratis-arc-select-backend-sdk).
compatibility: The chosen language toolchain and a versioned Chronicle release.
---

# Choose the client that will run the workload

For application work, choose the client for the process that will append or observe events, not the language of its caller. For example, when a React screen submits an order to a Node service, the service owns the Chronicle dependency; the screen calls the service. Start with that service's manifest:

- `.csproj`: [select the C# client](references/csharp.md).
- Node server `package.json`: [select the TypeScript client](references/typescript.md).
- `.kt`: [select the Kotlin application artifact](references/kotlin.md).
- `.java`: [select the Java-facing JVM client](references/java.md).
- `go.mod`: [distinguish standalone Go from an integrated host](references/go.md).
- `mix.exs`: [select the Elixir client for supervised application work](references/elixir.md).
- Python: there is no released application client. Call a service that owns the operation. For offline protocol tooling only, [build and check the matching contracts package](references/python.md).

Use generated contracts alone only when inspecting or encoding wire messages. A message round trip proves the wire type loads; it does not start an observer. Before committing to an application client, exercise the required operation against the intended kernel in a disposable namespace. If it fails, resolve the client/kernel mismatch or delegate to a supported host; do not force an unrelated contracts version.
