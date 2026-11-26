---
name: cratis-chronicle-record-event
compatibility: .NET SDK and a disposable Chronicle kernel for append checks.
description: Use when declaring an [EventType] record or appending a fact directly with IEventLog. Not for returning events from Handle() (cratis-arc-declare-command) or changing a registered schema (cratis-chronicle-evolve-event).
---

# Record an accepted fact

1. Start with the accepted outcome, not the requested action. If the history owner is unclear, send the actor and outcome to [Discover one timeline](../cratis-modeling-discover-timeline/SKILL.md); if its ID type is missing, pass the agreed owner to [Give a domain value a type](../cratis-fundamentals-name-value/SKILL.md). **Done:** the caller supplies one stable source ID; the payload contains what a future reader needs without re-querying mutable state.
2. Declare the past-tense fact in the discovered application assembly. Keep the existing event type identity once data exists. **Done:** the event store registers the type before the writer runs.

```csharp
[EventType]
public record AuthorRegistered(string Name);
```

3. For an Arc command, hand the declaration to [Return the outcome of an intent](../cratis-arc-declare-command/SKILL.md) and stop: don't append and return the same event. For a direct writer, await `eventLog.Append(authorId, new AuthorRegistered("Aster"))` and inspect the result before acknowledging acceptance. **Done:** a success has a sequence position; a constraint or concurrency refusal doesn't produce a success response. Read references/append-outcomes.md when a writer retries.
4. Read the source history in the same store and namespace. **Done:** exactly one matching payload at the returned position, not merely a successful method return. Read references/event-log-hygiene.md when the payload contains user identifiers or raw request data.

To deliver the full Add author flow, pass the fact and intended row to [Deliver one observable change](../cratis-platform-deliver-slice/SKILL.md). For application-level accepted/refused evidence, pass the command and source to [Prove the boundary a direct call misses](../cratis-specifications-exercise-backend/SKILL.md); the direct writer checks only the accepted append.

Run `dotnet test -c Release` in the application's event spec project against a disposable store. Read back the accepted append and compare its source, position and payload. If the read is empty, check the append result for a refusal before retrying.
