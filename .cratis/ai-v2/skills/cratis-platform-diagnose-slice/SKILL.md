---
name: cratis-platform-diagnose-slice
description: Locates the first missing result in an application slice. Use when a request succeeds but a query or screen stays stale, or a cross-layer path is slow. Not for repairing a known observer partition (use cratis-chronicle-inspect-observer).
compatibility: .NET SDK for backend checks; Playwright Chromium for browser checks.
---

# Find where one request stops reaching the screen

Follow one disposable input through the command, append, observer, query and open screen. Compare positions only within the same event store, namespace and sequence.

1. Record the expected row key and caller. Add the `Cratis.OpenTelemetry` NuGet package to the Library backend. In `Program.cs`, import `Cratis.OpenTelemetry` and register telemetry on the existing `WebApplicationBuilder` before `Build()`:

   ```csharp
   builder.AddCratisOpenTelemetry(options => options.ServiceName = "Library");
   ```

2. Check the command result and the append for that key. An accepted request alone does not establish a stored `AuthorRegistered` event.
3. Compare the matching observer position with the append position. Check the query for the expected row as the same caller.
4. Compare the open screen with the query. If a fresh read has the row but the screen does not, distinguish missing subscription delivery from incorrect rendering.

## Example: the registered author is missing

| Observation in the same namespace | Next check |
|---|---|
| Registration succeeded; `AuthorRegistered` is at 12 | Find the Author projection's position. |
| Position is 11; the query has no Aster row | The observer has not reached `AuthorRegistered`. Recheck the same partition. |
| Position reaches 12; the query now contains the keyed row | Check whether the open list received the update before changing the component. |

## Avoid

- Don't diagnose a failed append from an absent kernel span; host instrumentation does not configure kernel export.
- Don't compare a position from a different partition or namespace.
- Don't log credentials or sensitive event payloads; use the scoped identifiers and outcomes.

## Related skills

- [Inspect the observer](../cratis-chronicle-inspect-observer/SKILL.md) for a confirmed checkpoint gap.
- [Diagnose the live query](../cratis-arc-diagnose-live-query/SKILL.md) for a fresh read that does not reach the subscription.
