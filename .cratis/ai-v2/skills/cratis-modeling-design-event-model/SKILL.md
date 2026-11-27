---
name: cratis-modeling-design-event-model
description: Use when cutting an agreed business timeline into vertical slices or deciding where to reenter the event model for a behavior change. For one outcome's ownership and field origins, use cratis-modeling-discover-timeline.
---

# Design an event model

1. **Discover the timeline.** Agree on the goal and who can settle disputes. Brainstorm past-tense business events, arrange the causal plot and alternatives left to right, and sketch a storyboard of what each participant sees and does. Put each owning system, team or bounded context in a swimlane. [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) or [recover intent](../cratis-screenplay-recover-intent/SKILL.md) from an inherited application.
2. **Identify slices.** Cut each swimlane by behavior, not by technical layer. Classify a command that decides what to record as a **state change**; a query that presents a read model as a **state view**; a system acting on local facts as an **automation**; and adaptation between vocabularies as a **translation**. Check **information completeness**: trace displayed fields back to facts and facts back to inputs or prior state. Trace decision inputs and keys to their origin. Leave missing origins open.
3. **Model the agreement.** In a model-enabled project, put the slices in the owning module and feature. [Declare the state change and state view](../cratis-screenplay-declare-slice/SKILL.md), [model local automation](../cratis-screenplay-model-automation/SKILL.md) or [model translation](../cratis-screenplay-model-translation/SKILL.md). Validate the composed model and review its board with the owner. Use the board to communicate the order of the story, not to schedule execution. In a code-first project, keep the event model and examples without adding a Screenplay toolchain.
4. **Specify before implementation.** For each command with a business rule, note the deciding input or prior fact and its accepted event, refusal or legitimate no-op beside the diagram. Walk a contrasting example with the owner; arrows alone do not explain the decision. Settle changed behavior in Given/When/Then examples. [Specify the outcome](../cratis-screenplay-specify-outcome/SKILL.md), self-check, get independent review and [record acceptance against the exact revision](../cratis-screenplay-accept-model/SKILL.md).
5. **Implement the vertical slice.** Carry the accepted examples into [backend specifications](../cratis-specifications-exercise-backend/SKILL.md) and the changed runtime behavior. In an event-sourced slice, an Arc command decides what Chronicle appends for the event source; a projection or reducer builds the read model a query serves to the UI. Render supported behavior only and assign the gaps explicitly.
6. **Deliver and verify.** [Hand off the accepted slice](../cratis-screenplay-handoff-slice/SKILL.md) with its revision, address, examples, dependencies and target. [Verify the running slice](../cratis-platform-deliver-slice/SKILL.md): check the append or refusal, the derived query result and what the user sees separately.

## Example: add Aster to the library

In the Library swimlane, the librarian enters Aster. `RegisterAuthor` requests the **state change** and, if accepted, `AuthorRegistered` records the name on the author's event source. The **state view** reads `Author` through `AllAuthors`: the event source supplies the row ID and the event payload supplies the name. Given an empty listing, when the librarian registers Aster for a new author ID, then the fact is recorded for that ID and the listing gains the row with the same ID and name. Split that acceptance example into append and query checks. Start with declaring the two slices once the owner agrees.

Show the outside observations in a Directory swimlane. In the Library swimlane, translate the first observation into `DirectoryAuthorSeen` for its mapped author ID; an unchanged observation adds no fact. Then use that local fact to trigger an automation that requests a welcome. Check the first request and redelivery separately from the translation. Open the translation skill for the crossing and the automation skill for the follow-up.

Hand off the ordered timeline with swimlanes, typed slices, field origins, acceptance examples and the next specialist skill.

## When it goes off the usual path

- **Meaning is disputed:** keep the affected branch open and ask the owner to resolve a concrete counterexample. Don't specify invented behavior.
- **An accepted slice changes:** reenter at the affected step and recheck downstream examples. Repeat discovery only if the meaning is unresolved.
- **The target cannot run a modeled behavior:** assign the implementation gap and keep delivery unverified. A passing model spec or UI story is not evidence that the target runs it.
