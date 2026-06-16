---
name: event-modeling
description: Design a Cratis event model before writing code — decide stream boundaries, commands, events, read models, automations/translations, compliance subjects, and the spec outline. Use this when behavior, event vocabulary, stream boundaries, or a multi-slice flow is not yet settled, before implementing a slice.
---

# Event Modeling

Use this skill **before writing code** when behavior, event vocabulary, stream boundaries, or a multi-slice flow is not already settled. The output is an implementation brief: which commands exist, which stream each event lands on, which read models consume those events, which automations/translations react, and which specs prove the flow. Afterward, use the `create-event-model` skill to draw or update the Mermaid `EventModel.md` diagram.

Skip this only for mechanical changes where the event types and flow already exist and the request is just wiring or a narrow fix.

## The brief — decide before implementation

- **Module / feature / slice name and slice type** for each behavior (State Change / State View / Automation / Translation).
- **Commands:** inputs and the authorization (roles/policy) that gates them. Commands are imperative intents.
- **Events:** past-tense, one-purpose facts. **Decide the event source id for every event** — events never carry their own event-source id as a payload property. **Event properties are non-nullable** (Chronicle's analyzer warns otherwise); model optional facts as *separate* events, not nullable fields. Don't append events for derived/aggregate state — project that from source events.
- **Read models:** their consumers and source events; whether projection-backed, reducer-backed, or `[Passive]` (command-side decision only).
- **Automations / translations:** which events they react to, which side effects need `[OnceOnly]`, and whether they emit follow-up events or run commands via `ICommandPipeline`.
- **Specs:** happy path, validation failures, constraints, projections/reducers, reactor side effects.

## Compliance modeling (when personal data is involved)

Decide compliance *before* choosing event/read-model shapes:

- Prefer **one-subject event streams** for person-level PII. If an event carries PII about a natural person, decide the subject explicitly.
- Use **concept-level `[PII]`** for inherently personal values (names, email, phone, identity-provider subjects, personal notes/feedback). Keep business metadata unmarked.
- The subject defaults to the `EventSourceId<T>` identity — set `[Subject]`/`ICanProvideSubject`/a tuple `Subject` only when the subject is a non-`EventSourceId<T>` value. A managed read-model document has one subject — don't mix multiple people's PII in one document.
- Bearer tokens, magic links, and signed URLs are not durable facts — store keyed hashes / opaque references, not the secret.

## Output shape

Write the brief in this order: **(1)** stream boundaries and subjects → **(2)** commands and events → **(3)** read models and consumers → **(4)** automations/translations → **(5)** compliance notes → **(6)** specs.

If a subject boundary or erasure behavior can't be made person-level without changing product behavior, **stop and surface that trade-off** before implementing.

## See also

- `create-event-model` — render the chosen model into a Mermaid `EventModel.md`.
- `vertical-slices.md` — slice anatomy that implements the brief.
