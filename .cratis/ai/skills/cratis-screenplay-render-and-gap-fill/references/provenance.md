# Provenance

## Moved and rewritten (Cratis)
- The render workflow of the earlier model skill set: capability probe, renderability
  classification, delivery protocol, drift and fallback ledger. Rewritten for Stage 4.24 and cli
  3.27.1, with the render facts verified at those tags and by running `cratis render`; the
  helper scripts are not shipped (their steps are the manual commands in `references/delivery-protocol.md`).
- The fallback-conformance checklist moved into `cratis-application-slice-conformance`
  (`references/checklists.md`); this skill links it and keeps no copy.
- Three delivery cases (admission failure, generated base plus authorized gap-fill, fully
  hand-written delivery) and the whole-model rule: from the #493 plan review of render versus gap-fill.

## Ideas only (written independently)
- Idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/build-state-change/SKILL.md`
  and `build-state-view/SKILL.md`, written independently: verify against a contract with
  population, update and removal checks, and "repeat rejected versus idempotent success" as
  different guarantees (via `cratis-application-slice-conformance`).
- Idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.build-kit/CLAUDE.md` and `.build-kit/lib/*prompt*.md`,
  written independently: tests derived from the specifications are the oracle and never
  weakened; one scope per brief; the repository pattern beats template guidance; a field
  inventory; the specification delta as the work list on re-delivery
  (`references/gap-fill-handoff.md`).
- Idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/update-slice-status/SKILL.md` and
  `update-prompt-status/SKILL.md`, written independently: bounded, closed status per scope
  (the `done | partial | blocked` outcome and the ledger fields).

No TrogonStack/agentskills text is used in this skill.
