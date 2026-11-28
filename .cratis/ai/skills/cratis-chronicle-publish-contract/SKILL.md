---
name: cratis-chronicle-publish-contract
description: Use when publishing a selected public event between Chronicle stores and verifying receipt through the consumer inbox. Not for a local post-commit notification (use cratis-chronicle-react-to-fact).
compatibility: A supported application client and access to the intended kernel.
---

# Separate public eligibility, routing and receipt

Choose a deliberately public fact with no private payload. The Node and JVM event-type decorators/annotations do not expose public visibility, and Go source-store metadata is not a publication switch. Use a producer with verified public eligibility and routing, not an invented option. Producer eligibility, routing to the outbox, subscription registration, and consumption from the destination inbox are separate decisions. Do not publish a private internal event to simplify a mapping.

- C# (`.csproj`): [route the C# public event to the outbox](references/csharp.md).
- Node server (`package.json`): [subscribe from the Node destination](references/typescript.md).
- Kotlin (`.kt`): [subscribe from the Kotlin destination](references/kotlin.md).
- Java (`.java`): [configure the Java subscription bridge](references/java.md).
- Go (`go.mod`): [filter the Go subscription](references/go.md).
- Elixir (`mix.exs`): [publish and subscribe in Elixir](references/elixir.md).
- Python has no released application client: [consume a supported public service from Python](references/python.md).

In two disposable stores publish one eligible event alongside a private one. With a bounded wait, read the intended source-specific inbox: require the public payload and confirm the private event is absent. Check the consumer observer separately; a subscription acknowledgement proves neither forwarding nor handling.
