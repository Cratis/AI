---
name: cratis-chronicle-project-view
description: Use when building a Chronicle projection from events to keyed rows, children or graph edges. Not for prior-state transitions (cratis-chronicle-reduce-state) or exposing a query (cratis-arc-expose-query).
---

# Map events into keyed rows

1. Write the expected row after each input, including which event removes it. For Authors, the key is the source, not the submitted name. If field lineage is missing, take that field to `cratis-modeling-discover-timeline`. **Done:** two sources submitting identical values still yield two distinct rows.
2. Start with model-bound mapping. `[FromEvent<AuthorRegistered>]` maps like-named fields; `[RemovedWith<AuthorRemoved>]` removes the keyed row. Do not put a write or external call on the model. **Done:** the definition identifies subscribed types, key, field sources and deletion. Fixture excerpt (imports and event declarations in the example):

```csharp
[Passive]
[FromEvent<AuthorRegistered>]
[RemovedWith<AuthorRemoved>]
public record Author(AuthorId Id, string Name);
```

3. Choose the read path: passive folds on request; materialize when a query enumerates stored rows. Read references/mongo-sink.md when the consumer reads a Mongo collection. Use fluent mapping only for structure that property mappings cannot express; read references/joins-and-children.md for a cross-source join or keyed children and references/graph.md for vertices and edges. **Done:** the consumer reads the sink or fold the projection actually updates.
4. Feed two keyed histories; remove only the first. Assert the exact keys and values after reconstruction. If a row disappears for both, check the key selector before changing the query. **Done:** the other author's name remains intact. Hand that model to `cratis-arc-expose-query` only if it needs an endpoint.

Build `dotnet build Specs --configuration Release -warnaserror`, then run `dotnet test Specs --configuration Release --no-build` in the isolated fixture. Expect a mapped row and scoped removal; a compiled definition alone proves neither.
