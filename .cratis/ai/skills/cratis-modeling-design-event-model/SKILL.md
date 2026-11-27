---
name: cratis-modeling-design-event-model
description: Use when a modeler needs to cut an agreed timeline into vertical slices or revisit the event model for a behavior change. Not for discovering ownership or field origins (use cratis-modeling-discover-timeline).
---

# Design an event model

1. **Read the agreed timeline.** Lay out confirmed past-tense facts and alternatives in story order. Use the storyboard for what people see and do, and swimlanes for who owns each fact. If meaning is disputed, [walk through a counterexample](../cratis-modeling-discover-timeline/SKILL.md). The requesting user owns decisions unless they name someone else. Batch open decisions into one question; if told to proceed, label assumptions as assumptions, not acceptance.
2. **Identify slices.** Cut each swimlane by behavior, not technical layer. A **state change** decides what to record; a **state view** presents a derived read model; an **automation** acts on local facts; a **translation** adapts between vocabularies. Check information completeness: trace displayed fields back to facts, and decision inputs and keys back to their origins. Leave missing origins open.
3. **Agree on examples.** Record each consequential decision beside the slice. Contrast an accepted event with a refusal or legitimate no-op by changing one input or prior fact. Write down the owner of the history, the event destination, and what the user should see. When behavior changes, revisit only the affected slices and downstream examples.
4. **Choose the implementation path.** Use model-first only if the repository already has `.play` files under `model/` or the user asks for Screenplay or Stage. Otherwise work code-first: take the accepted event-model examples directly to [deliver the slice](../cratis-platform-deliver-slice/SKILL.md). No Screenplay workspace, export or handoff is needed.
5. **For model-first work**, [open the model workspace](../cratis-screenplay-onboard-workspace/SKILL.md). [Declare the command and view](../cratis-screenplay-declare-slice/SKILL.md), [model a local automation](../cratis-screenplay-model-automation/SKILL.md) or [translate an outside fact](../cratis-screenplay-model-translation/SKILL.md) as the timeline requires. [Specify the outcome](../cratis-screenplay-specify-outcome/SKILL.md), [review the exact revision for acceptance](../cratis-screenplay-accept-model/SKILL.md), then [hand off the accepted slice](../cratis-screenplay-handoff-slice/SKILL.md). For Stage generation, [preview and render](../cratis-stage-render-slice/SKILL.md); for manual implementation, deliver from the handoff. Verify on the target, not just in the model.

## Example: add Aster to the library

In the Library swimlane, a librarian requests `RegisterAuthor`. On success, `AuthorRegistered` records Aster on the addressed author's history. The Authors state view reads `Author` through `AllAuthors`: the event source supplies the row ID and the payload supplies the name. Given an empty listing, registering Aster for a new ID should add exactly one matching row without reloading. If the agreed blank-name outcome is a refusal, the command must explain it and append nothing.

An outside Directory observation belongs in another swimlane. Translate the first observation into `DirectoryAuthorSeen` for the mapped author ID; an unchanged observation adds no fact. A local automation may then request a welcome. Check redelivery separately from translation.
