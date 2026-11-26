---
name: cratis-screenplay-recover-intent
description: Use when recovering a candidate model from a recording of an inherited screen and distinguishing observed behavior from inferred intent. Not for deciding an unobserved business rule (use cratis-modeling-discover-timeline).
compatibility: Requires the Screenplay CLI.
---

# Recover a registration example from a recording

1. Record the application, screen, caller and frame range. For each relevant frame note the action or visible result. Do not label an event as observed unless the recording actually shows it.
2. Write three sets of notes: **observed** for what the frames show, **inferred** for a possible explanation, **unresolved** for a decision the recording cannot answer.
3. In a separate comparison workspace, compile the existing Library [registration and listing model](../cratis-screenplay-declare-slice/SKILL.md) with `screenplay model`. Compare the screen behavior with `Library.Authors.ListAuthors`. Do not add another declaration of `AuthorId` or `ListAuthors` to the application model.
4. Ask the domain owner about unresolved rules. To check a storage inference, inspect the recorded author's actual event history with permission; a second look at the same screen cannot establish an append.

## Example: the Authors screen after submission

| Classification | What to record |
|---|---|
| Observed | Frame 1: a librarian submits Aster. Frame 2: the Authors list contains Aster. |
| Inferred | `RegisterAuthor` may have appended `AuthorRegistered` for the new author ID. Neither frame shows persistence or a history address. |
| Unresolved | Neither frame shows a blank name. Ask what the librarian should see and whether the list changes. |

## Avoid

- Don't present the compiled model as a recording of an application run.
- Don't treat a behavior missing from the selected frames as a behavior the application never supports.

## Related skills

- [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) with the domain owner before encoding new rules.
