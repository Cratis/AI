---
name: cratis-chronicle-record-event
description: Use when declaring an [EventType] record or appending a fact directly with IEventLog. Not for returning events from Handle() (cratis-arc-declare-command) or changing a registered schema (cratis-chronicle-evolve-event).
---

# Record an accepted fact

1. Start with the accepted outcome, not the requested action. If the history owner is unclear, send the actor and outcome to `cratis-modeling-discover-timeline`; if its ID type is missing, pass the agreed owner to `cratis-fundamentals-name-value`. **Done:** the caller supplies one stable source ID; the payload contains what a future reader needs without re-querying mutable state.
2. Declare the past-tense fact in the discovered application assembly. Keep the existing event type identity once data exists. **Done:** the event store registers the type before the writer runs.

```csharp
using Cratis.Chronicle.Events;

[EventType]
public record AuthorRegistered(string Name);
```

3. For an Arc command, hand the declaration to `cratis-arc-declare-command` and stop: don't append and return the same event. For a direct writer, await `eventLog.Append(authorId, new AuthorRegistered("Aster"))` and inspect the result before acknowledging acceptance. **Done:** a success has a sequence position; a constraint or concurrency refusal doesn't produce a success response. Read references/append-outcomes.md when a writer retries.
4. Read the source history in the same store and namespace. **Done:** exactly one matching payload at the returned position, not merely a successful method return. Read references/event-log-hygiene.md when the payload contains user identifiers or raw request data.

To deliver the full Add author flow, pass the fact and intended row to `cratis-platform-deliver-slice`. For application-level accepted/refused evidence, pass the command and source to `cratis-specifications-exercise-backend`; the direct writer below checks only the accepted append.

In the disposable example fixture build `dotnet build Specs --configuration Release -warnaserror`, then run `dotnet test Specs --configuration Release --no-build`; expect the source, position and name to match.
