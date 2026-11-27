---
name: cratis-screenplay-recover-intent
description: Use when recovering a candidate model of an inherited system from runtime observations or static extraction, without treating either as accepted intent. Not for deciding an unobserved business rule (use cratis-modeling-discover-timeline).
compatibility: Requires the Screenplay CLI.
---

# Recover a registration example from a recording

1. Start with the available evidence. For a recording, record the application, screen, caller and frame range. For static extraction, record the analyzed source revision and the entry points it covers. Inventory jobs, message handlers, imports and admin writes as well as screens.
2. For each journey separate **observed** runtime results, **inferred** explanations and **unresolved** decisions. Note what static extraction covers, what was exercised and what neither proves. Use a second independent source only to settle a consequential inference.
3. In a separate comparison workspace, compile the existing Library [registration and listing model](../cratis-screenplay-declare-slice/SKILL.md) with `screenplay model`. Compare the screen behavior with `Library.Authors.ListAuthors`. Do not add another declaration of `AuthorId` or `ListAuthors` to the application model.
4. Ask the domain owner about consequential missing branches before accepting the candidate. To check a storage inference, inspect the recorded author's actual event history with permission. Record the runtime store, namespace and start/end timestamps (or sequence bounds) of the observation; map the recorded row or request to its event-source ID and compare the candidate facts with the events in that scope; a second look at the same screen cannot establish an append.

## Example: the Authors screen after submission

| Classification | What to record |
|---|---|
| Observed | Frame 1: a librarian submits Aster. Frame 2: the Authors list contains Aster. |
| Inferred | `RegisterAuthor` may have appended `AuthorRegistered` for the new author ID. Neither frame shows persistence or a history address. |
| Unresolved | Neither frame shows a blank name. Ask what the librarian should see and whether the list changes. |

## When it goes off the usual path

- **An observed event is absent from static extraction:** check whether its producer was in scope. Keep the observation and the coverage gap; don't conclude the event is invalid or that the model fully describes the application.

## Related skills

- [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) with the domain owner before encoding new rules.
