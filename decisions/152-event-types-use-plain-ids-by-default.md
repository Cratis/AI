---
id: 152
title: Event types use plain [EventType] by default; explicit ids only to retain a persisted id or resolve a collision
status: accepted
stage: implemented
class: contract
reversibility: costly
decided: 2026-11-10
decider: Sindre Alstad Wilting
applies-to:
  - ".cratis/ai/rules/application-profile.md"
  - ".cratis/ai/rules/vertical-slices.md"
  - ".cratis/ai/rules/general.md"
  - ".cratis/ai/skills/cratis-chronicle-event-type-migration/**"
issues: [1108]
qualifies:
  - "Documentation/decisions/0007-pin-explicit-event-type-ids-for-provider-crud.md"
  - "Documentation/decisions/0008-provider-crud-event-ids-match-directs-implicit-ones.md"
---

## Context

The corpus says new event types take no arguments, but the rule never said what "public" or "evolving" allows, and it was labelled a framework contract although Chronicle accepts any string id. Decisions 0007 and 0008 say provider CRUD events are "always pinned explicitly", for a real reason at the time: avoiding id collisions and keeping an application's implicit ids. A repository-local spec in a downstream application then pinned a UUID on every public event type, and later work copied the pattern. Operational identities derived from event type ids (deduplication keys, derived fact ids, replay receipts) made the pinned values harder to change afterwards.

## Decision

1. New event types, public contracts included, use plain `[EventType]`; the type name is the id. "Public" never implies a UUID or any explicit id. This is a house convention, not a Chronicle contract.
2. An explicit id is allowed only (a) to retain an already-persisted id after a rename or migration, or (b) to resolve a cross-package short-name collision (`MultipleEventTypesWithSameIdFound`).
3. Existing persisted ids are never changed or "normalized" to plain names.
4. Decisions 0007 and 0008 stay in force for the events they already pinned (retained ids and collision resolution). They no longer authorize pinning future events by default; each carries a dated banner pointing here.
5. On idioms and conventions the corpus wins over repository-local specs and design documents. A deviation needs an accepted decision record in the repository's decisions folder that names the corpus rule it replaces.

## Options considered

- **Forbid explicit ids outright.** Rejected: breaks retained ids after renames and collision resolution.
- **Leave 0007 and 0008 as "always pin".** Rejected: contradicts the corpus default, and an agent obeying the repository's records would keep pinning.
- **Qualify them (chosen).** Keeps both legitimate pin cases and keeps persisted ids safe.
- **Lint explicit ids in the verifier.** Not chosen: it cannot see downstream specs; evals prove the behavior instead.

## Default if unanswered

Authors follow the nearest repository spec, pin a UUID on every public event, and the pattern keeps spreading.

## Timeline and scope

Holds from the corpus release carrying it, for every repository that installs the corpus. Out of scope: rewriting any id already persisted.

Done when: the rules and the migration skill state the default and both allowed cases, decisions 0007 and 0008 carry forward banners, and the conformance fixtures for the plain, retained and ADR-exception cases exist.

Verify by: read those places and run the corpus verification and skill evaluation with the always-on budget check passing.

## Consequences

- New events read as their type names in the log; renaming a record is a deliberate migration, not an accident.
- A repository that wants pinned ids for new events records its own decision naming this one.
- An operational identity derived from an event type id is not covered by generations: keep the old id value or migrate that store.
