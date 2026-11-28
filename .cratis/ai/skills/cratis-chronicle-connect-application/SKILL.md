---
name: cratis-chronicle-connect-application
description: Use when connecting an application client to a named Chronicle store and namespace or verifying its readiness. Not for starting a kernel (use cratis-chronicle-deploy-kernel).
compatibility: A supported application client and access to the intended kernel.
---

# Open the store the workload will actually use

Start with the trusted kernel endpoint, application credentials, intended store and namespace. Use an application-lifetime client, not a connection per request. Keep credentials out of logs.

- C# (`.csproj`): [configure the standalone or combined host](references/csharp.md).
- Node server (`package.json`): [open a scoped Node store](references/typescript.md).
- Kotlin (`.kt`): [select the Kotlin store](references/kotlin.md).
- Java (`.java`): [own the Java blocking client](references/java.md).
- Go (`go.mod`): [dial and scope the Go store](references/go.md).
- Elixir (`mix.exs`): [wait for the supervised Elixir client](references/elixir.md).
- Python has no released application client: [use a service connection from Python](references/python.md).

A constructed client or selected store name is not proof of registration. In a disposable namespace open the intended store, append a registered fact and read it back. The same ID in another empty namespace must not return it. If transport is healthy but registration fails, inspect the artifact set rather than weakening TLS.
