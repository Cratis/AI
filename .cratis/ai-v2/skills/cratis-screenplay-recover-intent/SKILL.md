---
name: cratis-screenplay-recover-intent
description: Use when recovering a candidate Screenplay model from a recording of an inherited application without treating observed behavior as accepted intent. Not for deciding an unobserved business rule (use cratis-modeling-discover-timeline).
compatibility: Requires the Screenplay CLI.
---

# Recover a registration example from a recording

1. Record the application, screen, caller and frame range. List the actions exercised; leave any other entry point outside the recording's coverage.
2. Separate **observed** results, **inferred** explanations and **unresolved** decisions. A displayed result can support an inference about storage but does not prove it.
3. In a separate comparison workspace, compile the existing Library [registration and listing model](../cratis-screenplay-declare-slice/SKILL.md) with `screenplay model`. Compare the screen behavior with `Library.Authors.ListAuthors`. Do not add another declaration of `AuthorId` or `ListAuthors` to the application model.
4. Ask the domain owner about missing branches before accepting the candidate. To check a storage inference in a Chronicle-backed system, record the store, namespace, first sequence number and event-source ID. With an authorized `IEventSequence` for that scope, use `await sequence.GetFromSequenceNumber(firstSequenceNumber, authorId)` and compare only events within the recording's time or sequence bounds.

## Example: the Authors screen after submission

| Classification | What to record |
|---|---|
| Observed | Frame 1: a librarian submits Aster. Frame 2: the Authors list contains Aster. |
| Inferred | `RegisterAuthor` may have appended `AuthorRegistered` for the new author ID. Neither frame shows persistence or a history address. |
| Unresolved | Neither frame shows a blank name. Ask what the librarian should see and whether the list changes. |

## When it goes off the usual path

- **The recording doesn't identify the author or time window:** leave the append unresolved. Don't match a fact by the displayed name alone.

## Related skills

- [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) with the domain owner before encoding new rules.
