---
name: cratis-fundamentals-name-value
description: Use when defining a C# concept, strongly typed ID or Chronicle event source ID. Not for deciding whose history to use (cratis-modeling-discover-timeline) or declaring an event type (cratis-chronicle-record-event).
---

# Give a domain value a type

1. Ask what the value identifies. A display name can change without moving an author's history. A Chronicle source ID must continue selecting that same history after a rename. **Done:** one underlying scalar and one meaning for each type. If the owner is disputed, resolve the timeline before defining the ID.
2. Derive an ordinary scalar from `ConceptAs<T>`; use `EventSourceId<T>` specifically for the typed ID by which an event-backed command selects its history. **Done:** the command exposes the owner as its `Id`, not a new ID created inside `Handle()`. The fact type names what happened, not whom it happened to.

```csharp
using Cratis.Chronicle.Events;
using Cratis.Concepts;

public record AuthorName(string Value) : ConceptAs<string>(Value);
public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);
```

3. Round-trip a representative value through the application's configured serializer. Read references/wire-values.md when a client sees a wrapper instead of a scalar. **Done:** the name is the JSON string `"Aster"`, not an object with a `value` property, and the decoded concept compares equal to the input.
4. Execute the event-backed command with a known ID. Inspect the append for that source **and** its payload. A correctly formatted GUID in a response doesn't establish routing. **Done:** the matching fact is under the given ID; the scenario's complete append list has one entry. If the event landed elsewhere, inspect the command's ID type before changing the projection.

In the example fixture, run `dotnet build Specs --configuration Release -warnaserror`, then `dotnet test Specs --configuration Release --no-build`. Expect named scalar and dispatch checks, not just a successful restore.
