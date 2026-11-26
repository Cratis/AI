---
name: cratis-screenplay-declare-slice
description: Use when an agreed command, event or read model needs a state change or view slice in .play. Not for discovering the domain timeline (cratis-modeling-discover-timeline).
compatibility: Requires the Screenplay CLI.
---

# Declare the slice the actor agreed to

**Requires:** Check `screenplay --version`. If unavailable, restore the project's pinned CLI before validating the model.

1. Trace one accepted input to its observable result. **Done:** the actor, source identity, input and resulting fact are agreed; take unresolved examples to [Discover one timeline](../cratis-modeling-discover-timeline/SKILL.md).
2. Declare the identifier concept and event source. Bind the command production's `for` to the identifier; do not copy that ID into the fact just to recover a projection key. Read references/consistency.md when names collide. **Done:** changing the input ID changes the fact's destination, not its business payload.
3. Declare the keyed read model, projection and query in a StateView. For example, the author view derives its key from the source and its name from the event:

```screenplay
      projection AuthorProjection => Author
        from AuthorRegistered
          id = $eventSourceId
          name = name

      query AllAuthors => observable Author[]
```

   **Done:** each displayed field traces back to a fact or source identifier. If a key is missing, inspect its projection hop; use references/projection-lineage.md to trace each visible field back to its source.
4. Run `screenplay ./model` and `screenplay test model --format json`, substituting the application model directory. **Done:** compilation exits zero and the intended write, refusal and read scenarios all execute and pass. This does not authorize rendering.
