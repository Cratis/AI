# Provenance

## Adapted closely (MIT, TrogonStack/agentskills)

Source: https://github.com/TrogonStack/agentskills at commit `7b249d3ee42d8b7e11fa564141ebd5fbc37aadf1`,
Copyright (c) 2025 Straw Hat, LLC. The full notice is in this skill's `LICENSE`.

| Source file (under `plugins/trogonstack-eventmodeling/skills/`) | Used in | How |
|---|---|---|
| `eventmodeling-brainstorming-events/SKILL.md`: Interview Phase (when to interview, critical questions with impact, why it matters and follow-up triggers, conditional entry, two-pass flow) | `SKILL.md` "Interview phase", `references/interview-questions.md` "Interview flow" | structure and four questions adapted; results land in STATE.md instead of a trail file |
| same: Workshop Facilitation Guide (goals, free brainstorm, gentle filtering dialogue, key points, tips for facilitators) | `references/human-workshop.md`, `references/facilitation.md` | adapted to marina examples and Screenplay; the agent scribes |
| same: Role Catalog (mandatory; description, key actions, permissions boundary; system actors with triggers) | `references/personas-and-causes.md`, `SKILL.md` step 2 | adapted to `persona` Does / Reads / Cannot and non-human causes; Cannot resolved to executable gates |
| same: Best practices and Quality Checklist | `SKILL.md` Gate, `references/event-naming.md` | adapted; absolute "all error conditions have events" not adopted |
| `eventmodeling-brainstorming-events/references/facilitating-event-modeling-workshops.md`: participants, invitation, workspace, templates, pacing, personalities, disagreement, remote, post-workshop, multi-day, checklists, success indicators | `references/human-workshop.md` | structure adapted closely; mapped to Screenplay constructs and Cratis phases |
| `eventmodeling-plotting-events/SKILL.md`: sequence, dependencies (can only happen after / triggered by / precondition), alternative paths, output format, quality checklist, principles | `references/plotting-and-handoff.md`, `SKILL.md` step 5 | adapted: after / caused by / only if in the slice `description`; plot format and checks |

Not adopted from the same sources, and why: the "never use an aggregate" rule and per-command state
examples (stream and state design belong to `cratis-screenplay-streams-and-consistency`);
the `.trogonai/interviews/` trail file (replaced by bounded STATE.md); e-commerce examples and
Gherkin forms; the `total (calculated)` field example (contradicts the calculated-value rule);
"capture every error condition as an event" (most failures are rejections).

## Ideas only (written independently)

- Idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/timeline/SKILL.md`, written independently:
  a fixed opening question when there is no input, the build-first-then-summarise turn and explicit
  stop conditions (`SKILL.md` "Interview phase", `references/storming-loop.md`,
  `references/interview-questions.md`).
- Idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/eventmodeling-interview-protocol/SKILL.md`,
  written independently: skip what is already known; assume visibly when told not to ask; keep what
  was decided apart from what was assumed (`SKILL.md` "Interview phase").

## Original to this corpus

The divergent sweep lenses, the not-an-event filter and its exceptions, the edit kinds, the
compiled discovery skeleton, persona Cannot resolution to gates and denial specs (S6), the
compiler-contract notes and identity-affecting edit routing.
