---
name: cratis-chronicle-react-to-fact
description: Use when handling an appended Chronicle fact with a reactor, including replay-safe effects and derived events. Not for deriving a read model without effects (use cratis-chronicle-project-view).
compatibility: A supported application client and an observed event type.
---

# Deliver an effect without sending it twice

For a notification that must only begin after deployment, set the initial subscription position to the tail **and** exclude the notification from replay. Neither choice prevents retries after an interrupted acknowledgement. Give each distinct effect a stable key for the observed delivery, and have the receiver enforce it atomically with the effect. A local “sent” flag written after a successful external call leaves a crash window.

- `.csproj`: [implement a reactor and receipt](references/csharp.md).
- Node `package.json`: [bind a method to the event](references/typescript.md).
- `.kt`: [register the annotated handler](references/kotlin.md).
- `.java`: [handle a single event or explicit batch](references/java.md).
- `go.mod`: [register the reactor factory](references/go.md).
- `mix.exs`: [handle the registered event module](references/elixir.md).
- Python has no released application client: [delegate subscription ownership](references/python.md).

Deliver the same event twice after simulating a lost acknowledgement. Expect one externally visible effect. Test replay separately from retry and initial catch-up. If the receiver cannot deduplicate, stop before enabling automatic redelivery of an irreversible effect. For a failing partition, inspect progress (`cratis-chronicle-inspect-observer` skill) before changing delivery policy.
