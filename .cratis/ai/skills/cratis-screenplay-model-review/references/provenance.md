# Provenance

## Closely adapted (MIT)

Source: https://github.com/TrogonStack/agentskills at commit
`7b249d3ee42d8b7e11fa564141ebd5fbc37aadf1`, path `plugins/trogonstack-eventmodeling/skills/`.
MIT, Copyright (c) 2025 Straw Hat, LLC. The complete notice is in this skill's `LICENSE`.

| Source skill | Adapted into | How |
|---|---|---|
| `eventmodeling-validating-event-models-checklist` | `checklist.md` (phase layout, per-phase check counts), `report-template.md` (per check: status, element, evidence; anti-patterns block; final questions; verdict and success criteria), `anti-patterns.md` ("Calculation events", "Circular dependencies", "Shared versus handler-owned state", "Persistent versus ephemeral state" translated to Screenplay), `review-questions.md` (per-subject questions and per-domain examples) | Structure and wording adapted closely; every code and class term mapped to Screenplay constructs; the 16 checks became the phased checklist with additions |
| `eventmodeling-validating-event-models` | `checklist.md` T (allowed and refused transitions per entity), C7 and C8 (unique semantics, corrections name what they correct), F3, G (role attribution and coverage), D and E (read models serve real queries, regenerable), `report-template.md` (critical and warning findings, completeness table) | Adapted; the command-state rule is not adopted as such (Screenplay decisions read stored state through `reads`; see `anti-patterns.md`) |
| `eventmodeling-checking-completeness` | `checklist.md` A (origin and destination for every field, every command input, every read-model field), A8 (step contracts), G (role coverage), `references/worked-example.md` (field-trace format) | Adapted; matrices replaced by lineage over `.play` declarations |

## Ideas written independently (not copied)

Nebulit-GmbH/agentic-engineer has no licence; nothing is reproduced beyond short phrases.

| Idea | Source | Where it lands |
|---|---|---|
| Read-only model analysis with counts, status, spec coverage and structural gaps | idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/analyze-existing-model/SKILL.md`, written independently | SKILL.md "Audit pass", `report-template.md` Inventory |
| One remark per element, with a kind (question, task, comment) and a resolve step | idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/handle-comment/SKILL.md`, written independently | SKILL.md "Findings" (one finding per declaration, kinds, states on re-review) |
| Business-analyst pass: read the model fresh, ask only grounded plain-language questions, zero is valid, drawings versus questions | idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/wdyt/SKILL.md`, written independently | `business-questions.md` (categories, language rule, themes) |
| Structural shapes as signals, one of which is always reported | idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/eventmodeling-core-rules/SKILL.md`, written independently | `anti-patterns.md` structural shapes |

## Other lineage

- Event Modeling (Adam Dymitruk) and Martin Dilger, *Understanding Eventsourcing*:
  completeness, vertical slices, the structural-shape signals.
- Alexey Zimarev, Oskar Dudycz, Vaughn Vernon and others on stream and boundary design:
  the boundary rows of `anti-patterns.md`.
- Draft lineage of the first draft of this skill: the field-copy signal, the element sweep
  and the entity walk are Cratis additions, grounded in Cratis/Screenplay#393 (advisory report
  of information-level modeling smells, open at v4.64.0).
- Rejected anti-patterns (`checklist.md` R): Cratis/Screenplay strategy decisions and the
  closure comments of the Screenplay issues that rejected them.
