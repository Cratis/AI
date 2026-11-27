---
name: cratis-modeling-discover-timeline
description: Use when event modeling a business journey, identifying who owns a recorded event, identifying the event source or tracing a screen field to its origin. Not for expressing an agreed slice in .play (use cratis-screenplay-declare-slice).
---

# Discover the business timeline

1. Ask for one outcome. Record the actor, input and visible result in the owner's words.
2. Arrange past-tense business events left to right as a causal plot, including alternative paths. Sketch what participants see and do as a storyboard. Give each owning system or bounded context a swimlane.
3. Name the command for what the actor requests and the event for the business outcome, not the database write. Mark whose history gained the fact: write the event source ID beside the event, separate from the caller.
4. Check information completeness. Walk each displayed value to its origin: in the authors list, the event source supplies the row key and the payload supplies the name.
5. Change one input to expose a boundary. Ask what should be refused, what the caller sees and what must remain unchanged. Keep unanswered questions open.
6. Cut the plot by behavior within the owning swimlane. [Design the event model](../cratis-modeling-design-event-model/SKILL.md) to choose the slice patterns and carry the agreed journey into examples.

## Example: register an author

Record the plot and its unresolved branch in `Features/Authors/Registration/timeline.md`. In the Library swimlane, arrange `AuthorRegistered` then `AuthorRemoved`; sketch the librarian submitting the name, seeing the new row, and later removing it. Registration and removal are separate state changes. The list is a state view fed by both facts.

| Question | Concrete example |
|---|---|
| Who asks for what? | A librarian requests `RegisterAuthor` with ID `11111111-1111-4111-8111-111111111111` and name Aster. |
| What happened, and to whom? | `AuthorRegistered` records Aster in that author's history. |
| What changes on screen? | The authors list gains the row for that author ID. |
| Where does the name come from? | The row takes its name from `AuthorRegistered.Name`. |
| Which decision is still open? | Ask the owner what the librarian should see after submitting a blank name. |

## When it goes off the usual path

- If accounts of the refusal disagree, sketch both outcomes and take the smallest example that distinguishes them to the owner. Don't mark either as accepted yet.
- If all you have is a recording of the screen, note the visible result and [recover intent](../cratis-screenplay-recover-intent/SKILL.md). Verify the event and its address before treating either as fact.

## Related skills

- [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) to encode the agreed example.
- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) to implement its visible result.
