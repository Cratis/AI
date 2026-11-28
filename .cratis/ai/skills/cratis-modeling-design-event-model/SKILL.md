---
name: cratis-modeling-design-event-model
description: Use when an agreed timeline needs slices, concrete examples and a choice of implementation path, or a changed rule needs its affected slices reviewed. Not for discovering disputed intent (use cratis-modeling-discover-timeline).
---

# Design an event model

Start with one outcome someone needs and the request or trigger that starts it. For Library, a librarian registers Aster and sees the new author in the open Authors list. Deliver the registration and its consuming list together, not a write layer for every feature. If the intent is disputed, [return to discovery](../cratis-modeling-discover-timeline/SKILL.md). If the starting point is code rather than an agreed timeline, [trace existing behavior](../cratis-modeling-trace-existing-behavior/SKILL.md).

## Choose the slice kind and trace its values

- **StateChange:** What must the command decide, and whose history changes? Identify required inputs: supplied by the caller, available from prior state, generated or derived by a stated rule. Name the immutable facts and their typed payloads, or explain why nothing is appended. Don't copy every command field into the fact.
- **StateView:** What question must the reader answer? Work back from the query, its selection key or collection, and the row identity to the projection and contributing facts. Name the producing slices. The screen presents the answer; it doesn't own the facts.
- **Automation:** Which local fact, schedule or application signal calls for follow-up? Name the addressed target and effect: invoke a command if a decision remains, or record an already known fact. For example, a local `DirectoryAuthorSeen` triggers a welcome request for that author, not proof of delivery.
- **Translate:** Which vocabulary boundary does the data cross? Inbound, map a stable outside key and meaningful change to a local fact. If the Directory supplies the Library author ID, its first observation of Aster can produce `DirectoryAuthorSeen` on that author's history; an identical observation can succeed without appending. Keep the welcome separate. Outbound, map private `AuthorRegistered` to one public `AuthorPublished` contract, retaining the author's key and name; transport is a separate check.

An `optional` property permits absence on the fact, not a second outcome when the owner expects a different decision. The bundled Cratis renderer can refuse an optional event payload property that source validation accepts. Keep the owner's meaning; choose the correct fact rather than filling a required field with a fabricated value. Name that decision separately. If two facts always follow unconditionally from the same decision, keep them as productions of that decision. Do not invent a reaction between them. For a genuinely conditional follow-up, name the triggering occurrence, state consulted, condition and outcome. Ask “when would this not happen?” to find a refusal or a successful no-op. Ask “could two be in progress?” before choosing a single-instance view.

When recording the agreed values in Screenplay, a primitive-backed concept names one `Uuid`, `String`, `Int`, `Decimal`, `Bool`, `Date` or `DateTime` value. Use names that distinguish equal-looking IDs with different owners. Mark personal data on the concept with `pii` and document why the classification applies. Identify the person the data concerns separately from the stream address. A classification does not by itself establish lawful use or successful erasure.

## Test the decision with the owner

Let A be `11111111-1111-4111-8111-111111111111`. Given no history at A and an empty list, the librarian submits `RegisterAuthor(A, "Aster")`. On acceptance, `AuthorRegistered(Name: "Aster")` is recorded on history A. `ListAuthors` consumes that fact: `AllAuthors` shows exactly one new `Author` row with ID A and name Aster without refreshing. Change just the name to blank: **if** the owner agrees it is refused, expect a reason and no append. Unlike an unchanged Directory observation, this is not success.

Turn feedback into a contrasting example before changing the rule. [Review one slice](references/review-one-slice.md) when an input lacks an origin or a change affects a consumer. Ask the requester (or their named decision owner) the unresolved questions in one batch. Proceed provisionally only if asked; mark unaccepted results. A draft or passing specification isn't owner agreement.

## Choose delivery

**Code-first by default.** Take accepted examples directly to deliver the slice (`cratis-platform-deliver-slice` skill in `cratis/application`): declare the event type, implement the Arc decision, project and query the view, and connect the UI as applicable. No `.play` file, export, handoff or Stage required.

**Model-first only** when the `general` rule (Approval is not execution) selects it after checking opt-in and frozen status. Use the skills from `cratis/screenplay` to open the workspace (`cratis-screenplay-onboard-workspace` skill). Declare commands, facts and views (`cratis-screenplay-declare-slice` skill) as needed; for interactive work, bind the gesture, form or read (`cratis-screenplay-model-interaction` skill). For system work, model the local reaction (`cratis-screenplay-model-automation` skill) or boundary translation (`cratis-screenplay-model-translation` skill) without inventing a screen. Specify the outcome (`cratis-screenplay-specify-outcome` skill), obtain acceptance for the exact revision (`cratis-screenplay-accept-model` skill), then hand off the slice (`cratis-screenplay-handoff-slice` skill). For changes, revise and recheck (`cratis-screenplay-edit-workspace` skill) before seeking acceptance again. With separate authorization, render with Stage (`cratis-stage-render-slice` skill in `cratis/stage`) or implement manually (`cratis-platform-deliver-slice` skill in `cratis/application`).

**Hand over:** slice name and kind, intent or trigger, addressed identity, field origins, event type and payload where applicable, read result or follow-up, agreed contrasting examples, dependent slices, owner and remaining assumptions. Acceptance records a domain decision, not permission to execute. On either path, verify the event schema, target identity and observable outcome on the authorized target, not just generated files or model results.
