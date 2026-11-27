---
name: cratis-arc-select-backend-sdk
description: Use when a developer needs to choose an Arc backend or run a native command in Node, Kotlin, Java, Elixir or Go. Not for the Chronicle client lifecycle (use cratis-chronicle-select-client).
compatibility: Requires the toolchain for the selected host.
---

# Choose the backend that owns the request

Use the language and host of the service that owns the feature. Prove the command with its native dispatcher before integrating a browser client. A compatible HTTP envelope doesn't make .NET attributes, dependency injection or commit semantics portable.

| Host | First runnable check |
| --- | --- |
| ASP.NET Core | [Start an Arc host](../cratis-arc-host-application/SKILL.md), [declare the command](../cratis-arc-declare-command/SKILL.md), then [invoke it](../cratis-arc-invoke-command/SKILL.md). |
| Node / TypeScript | [Run a decorated command](references/node.md) and read back its task over HTTP. |
| JVM / Kotlin or Java | [Run a Spring Boot command](references/jvm.md) with the generated adapters for that language. |
| Elixir / OTP | [Execute an append command](references/elixir.md) in an isolated application. |
| Go | [Register a typed handler](references/go.md) and inspect its reply. |

For a retained ASP.NET Core MVC receipt endpoint, use the controller's existing route and test its actual result and authorization. Don't move it to a model-bound API only to reuse a sample request.

## When a client must work with two services

Check an authorized success and an invalid or unauthorized request on **each** host. Compare the generated route, payload, casing, validation fields and result. Only call `/validate` if the host advertises that route. A successful native reply is neither an HTTP compatibility test nor proof of a durable append. If the feature requires durable storage, [select a Chronicle client](../cratis-chronicle-select-client/SKILL.md) and verify the write separately.
