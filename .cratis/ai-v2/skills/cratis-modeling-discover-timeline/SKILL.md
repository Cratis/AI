---
name: cratis-modeling-discover-timeline
description: Use when event modeling a timeline, choosing stream boundaries or tracing a screen field back to an event. Not for encoding an agreed slice in .play (cratis-screenplay-declare-slice).
---

# Discover one timeline

1. Start at the screen where a person expects a change. Ask the person playing that role to supply an actual input and what they would see next. Read references/interview.md when the answer is a storage operation rather than a business outcome. **Done:** a named actor, trigger and observable result, without assuming a database or model file.
2. Walk forward: action → command (intent) → fact in past tense → view → next screen. Name the history owner independently of the document being displayed. Read references/mermaid.md when the group needs a diagram. **Done:** each fact has a source key and two independently acting subjects do not accidentally share a history.
3. Walk backward from each required field, including row identity. Mark a field with no source as an open question, not a guessed event property. **Done:** the table identifies an origin for every field proposed for acceptance.

| Actor action | Intent | Recorded under | Fact | View → screen |
|---|---|---|---|---|
| Catalog editor submits Aster | RegisterAuthor | AuthorId of the new author | AuthorRegistered(Name=Aster) | Author.Id from source; Author.Name from fact → Authors list row |

4. Replay the example with the stakeholder, then change one input: blank name → field error, no fact, list unchanged. Record agreed outcomes separately from decisions still needed (for example whether two authors can share a name). **Done:** an explicit acceptance or named decision owner for each open point. A passing consistency check is not stakeholder approval.

Run `node --test acceptance.test.mjs` in the example fixture to check field lineage and the success/refusal traces. Only carry the agreed portion to implementation; hand it to `cratis-screenplay-declare-slice` only if a model artifact is requested.
