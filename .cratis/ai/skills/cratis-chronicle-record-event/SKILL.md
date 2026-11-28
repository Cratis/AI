---
name: cratis-chronicle-record-event
description: Use when declaring a Chronicle event, appending it from a standalone writer or checking its accepted position. Not for returning a fact from an Arc command (use cratis-arc-declare-command).
compatibility: A supported application client and access to the intended kernel.
---

# Append a fact to its intended history

Choose the stable event type and generation, source key and target sequence before writing. The source identifies the history; a correlation ID identifies a workflow, not a business entity. Keep the payload a fact about the past.

- C# (`.csproj`): [declare and check the C# event](references/csharp.md).
- Node server (`package.json`): [append a registered Node event](references/typescript.md).
- Kotlin (`.kt`): [append from a Kotlin coroutine](references/kotlin.md).
- Java (`.java`): [append through the Java facade](references/java.md).
- Go (`go.mod`): [register and append the Go value](references/go.md).
- Elixir (`mix.exs`): [inspect the detailed Elixir result](references/elixir.md).
- Python has no released application client: [submit an intent from Python](references/python.md).

In a disposable namespace verify the accepted type, source and content by reading its sequence. Acceptance does not prove downstream delivery. For a confirmed refusal report the structured reason; after a lost response reconcile the original attempt before resubmitting. A new source key or idempotency key is a different write.
