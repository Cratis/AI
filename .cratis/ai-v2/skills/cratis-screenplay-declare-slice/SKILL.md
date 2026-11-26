---
name: cratis-screenplay-declare-slice
description: Use when an agreed state change or view must be expressed in .play. Not for discovering a domain timeline (cratis-modeling-discover-timeline).
---

# Declare the slice the actor agreed to

1. Start from one accepted input and observable result. If the actor, history owner or refusal is disputed, return the example to [timeline discovery](../cratis-modeling-discover-timeline/SKILL.md). **Done:** Register author has one permitted catalog editor, one AuthorId, one submitted Name and a distinct AuthorRegistered outcome.
2. Put the command and its past-tense event in a StateChange slice; bind the production's `for` to the command identifier. Declare the identifier concept and the event source separately. Hand its C# representation to [domain value typing](../cratis-fundamentals-name-value/SKILL.md) only when implementing it. Do not add an ID field to the fact just to project the key. Read references/consistency.md when names collide. **Done:** changing the input ID moves the fact's destination, not its business payload.
3. Give the StateView a keyed read model, projection and query. Read references/projection-lineage.md when tracing a displayed value. **Done:** Authors.Name traces backward from AllAuthors through Author.Name to AuthorRegistered.Name and the submitted Name; Author.Id comes from the source. Run `screenplay lineage Catalog.Authors.ListAuthors.Author.name model` and check the projection and production hops.
4. In the [declaration fixture](../../../../Evaluations/corpus-v2/examples/cratis-screenplay-declare-slice), run `screenplay ./model --warnaserror`, then `screenplay test model --format json`. **Done:** no diagnostics and RegisteringAster, ListingAster and RejectingAnEmptyName execute successfully. This does not authorize rendering.
