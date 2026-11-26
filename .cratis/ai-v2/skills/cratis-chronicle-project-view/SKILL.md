---
name: cratis-chronicle-project-view
compatibility: .NET SDK and Chronicle projections.
description: Use when building a Chronicle read model that projects events into keyed rows, children or graph edges. Not for prior-state transitions (cratis-chronicle-reduce-state) or exposing a query (cratis-arc-expose-query).
---

# Map events into keyed rows

1. Write the expected row after each input, including which event removes it. For Authors, the key is the source, not the submitted name. If field lineage is missing, take that field to [Discover one timeline](../cratis-modeling-discover-timeline/SKILL.md). **Done:** two sources submitting identical values still yield two distinct rows.
2. Start with model-bound mapping. `[FromEvent<AuthorRegistered>]` maps like-named fields; `[RemovedWith<AuthorRemoved>]` removes the keyed row. Do not put a write or external call on the model. **Done:** the definition identifies subscribed types, key, field sources and deletion. For example:

```csharp
[Passive]
[FromEvent<AuthorRegistered>]
[RemovedWith<AuthorRemoved>]
public record Author(AuthorId Id, string Name);
```

3. Choose the read path: passive folds on request; materialize when a query enumerates stored rows. Read references/mongo-sink.md when the consumer reads a Mongo collection. For a read that combines sources, see [joins and keyed children](references/joins-and-children.md); for a relationship traversal, see [vertices and edges](references/graph.md). **Done:** the consumer reads the sink or fold the projection actually updates.
4. Feed two keyed histories; remove only the first. Assert the exact keys and values after reconstruction. If a row disappears for both, check the key selector before changing the query. **Done:** the other author's name remains intact. Hand that model to [Expose the read, not the projection](../cratis-arc-expose-query/SKILL.md) only if it needs an endpoint.

Run `dotnet test -c Release` in the application's projection spec project. After removing one source, only its row disappears; the other key and mapped values remain unchanged.
