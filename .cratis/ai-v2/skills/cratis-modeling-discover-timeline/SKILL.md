---
name: cratis-modeling-discover-timeline
description: Use when event modeling a business journey, identifying who owns a recorded event, choosing a stream boundary or tracing a screen field to its origin. Not for expressing an agreed slice in .play (use cratis-screenplay-declare-slice).
---

# Trace one business example

Write the example as the table below in `Features/Authors/Registration/timeline.md`. Record who submits the name, which author it belongs to and how the librarian knows registration succeeded.

1. Ask for one outcome. Record the actor, the input and the visible result in the owner's words.
2. Walk the input forward. Name the command for what the actor requests and the event for what happened.
3. Ask whose history gained the event (here, the author's). Write that ID beside the event, separate from the caller.
4. Walk each displayed value back to its origin. Identify the value carried in the payload and the key identifying the row.
5. Change one input to expose a boundary. Ask what should be refused, what the caller sees and what must remain unchanged. Keep unanswered questions open.

## Example: register an author

| Question | Concrete example |
|---|---|
| Who asks for what? | A librarian requests `RegisterAuthor` with ID `11111111-1111-4111-8111-111111111111` and name Aster. |
| What happened, and to whom? | `AuthorRegistered` records Aster in that author's history. |
| What changes on screen? | The authors list gains the row for that author ID. |
| Where does the name come from? | The row takes its name from `AuthorRegistered.Name`. |
| Which decision is still open? | Ask the owner what the librarian should see after submitting a blank name. |

## Avoid

- Don't name the event “row inserted”; name the business outcome.
- Don't address `AuthorRegistered` to the librarian who entered the name; use the author ID.
- Don't promote a proposed refusal to an agreed rule without the owner's answer.

## Related skills

- [Recover intent](../cratis-screenplay-recover-intent/SKILL.md) when the starting point is an existing implementation rather than a workshop.

- [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) to encode the agreed example.
- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) to implement its visible result.
