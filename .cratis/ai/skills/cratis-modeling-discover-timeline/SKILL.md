---
name: cratis-modeling-discover-timeline
description: Use when a modeler needs to discover the actors, event ownership and field origins of a business journey with its owner before coding. For cutting an agreed timeline into slices, use cratis-modeling-design-event-model.
---

# Discover the business timeline

1. Start with one real completed instance. Record the actor, input and visible result in the owner's words.
2. Arrange past-tense business events left to right as a causal plot. Sketch what participants see and do as a storyboard. Give each owning system or bounded context a swimlane. Name the storyline if it crosses features and needs revisiting.
3. Name the command for what the actor requests and the event for the business outcome, not the database write. Mark whose history gained the fact: write the event source ID beside the event, separate from the caller.
4. Check information completeness. Walk each displayed value to its origin: in the authors list, the event source supplies the row key and the payload supplies the name.
5. Read the plot back in story order to the person who does the work. When the answer is "usually", ask what decides the outcome. Change one input at a time; record one example that distinguishes the outcomes, where its deciding input comes from and what remains unresolved.
6. Once the outcome is agreed, [design the event model](../cratis-modeling-design-event-model/SKILL.md) to cut the timeline into slices.

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

- [Design the event model](../cratis-modeling-design-event-model/SKILL.md) to cut the agreed timeline into slices.
- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) to implement its visible result.
