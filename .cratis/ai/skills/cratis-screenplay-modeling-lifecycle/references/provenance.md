# Provenance and licences

## Shared template for sibling skills (copy this header; replace the tables)

Every new Screenplay method skill keeps a `references/provenance.md` shaped like this one. Three
sections, in this order:

1. **Adapted from MIT sources.** One row per passage, procedure, checklist, interview protocol or
   output format adapted closely from a licensed source: skill and file in the source, source
   commit, what it became here (section or reference), and how it was adapted. If this section is
   not empty, the skill `LICENSE` carries the "Third-party notices" section with the **complete**
   MIT text (copyright line, permission notice and disclaimer). Closely adapted material is
   attributed to the source it came from, not to a neighboring one.
2. **Ideas from unlicensed sources.** One row per idea, in the form
   `idea from <repository>@<commit>:<path>, written independently`. These are written in our own
   words with no passage beyond a short phrase. If a substantial reuse is ambiguous, flag it to the
   maintainer instead of resolving it silently.
3. **Method lineage.** Public method sources (books, talks, standards), cited as sources of ideas.

Do not name a person's tooling, a harness's model or a private path. Update the commit pins here
when a source is rechecked, and say what was rechecked. A shingle (8-word overlap) scan across
the changed artifacts is a warning aid only, never legal clearance.

## 1. Adapted from MIT sources

Source: TrogonStack/agentskills, plugin `trogonstack-eventmodeling`, commit
`7b249d3ee42d8b7e11fa564141ebd5fbc37aadf1`. MIT licence, Copyright (c) 2025 Straw Hat, LLC. The
full notice is in this skill's `LICENSE` ("Third-party notices").

| Source skill and file | Became | Adaptation |
|---|---|---|
| `eventmodeling-orchestrating-event-modeling/SKILL.md`, "Workflow" (per-step **Input / Output to carry forward / Gate**) | `phases.md`, every phase P0-P9 | The template is applied to the Screenplay lifecycle; steps, inputs and gates rewritten for `.play` work |
| same file, "Interview Phase" (skip condition, five intake questions, one confirmation sentence) | `SKILL.md` "Interview phase (P0)" | Questions and confirmation sentence adapted to Screenplay modes; unattended behavior added |
| same file, "Capture findings" and Interview Trail table | `handoff-template.md` section 1 | The trail moved into STATE.md under `.ai-work/screenplay/`, with an asked/assumed column |
| same file, "Mid-Workflow Entry" | `SKILL.md`, `phases.md` "Resume mid-workflow" | Entry points table and identity recomputation added |
| same file, "Final Output" and "Quality Checklist" | `phases.md` "Final output" and "Quality checklist (closing)" | Items rewritten around Screenplay verdicts, specifications and review |

## 2. Ideas from unlicensed sources

The Nebulit-GmbH/agentic-engineer repository carries no licence. These are ideas only, written
independently.

| Idea | Where it appears |
|---|---|
| idea from Nebulit-GmbH/agentic-engineer@07b0f30:.claude/skills/eventmodeling-core-rules/SKILL.md, written independently: modeling and critic postures are never mixed in one pass | `SKILL.md` "Modes" stance sentence |
| same file: a refusal that is known is a documented rule, so a decided rejection is a specification | `SKILL.md` "Completeness over economy" |
| idea from Nebulit-GmbH/agentic-engineer@07b0f30:.claude/skills/eventmodeling-interview-protocol/SKILL.md, written independently: when unattended, assume visibly and record what was asked versus assumed | `stop-or-assume.md` |
| idea from Nebulit-GmbH/agentic-engineer@07b0f30:.claude/skills/request-feedback/SKILL.md, written independently: questions are readable cold and anchored to a model element | `stop-or-assume.md`, `handoff-template.md` section 4 |
| idea from Nebulit-GmbH/agentic-engineer@07b0f30:.agent-modeling-kit/CLAUDE.md, written independently: a run ends with one closed outcome, never neither progressed nor closed; load the skill before authoring instead of calling raw tools | `SKILL.md` "Run protocol", `stop-or-assume.md` |
| idea from Nebulit-GmbH/agentic-engineer@07b0f30:.claude/skills/connect/SKILL.md, written independently: discover capabilities once per session | `SKILL.md` "Run protocol", `identity-and-edits.md` |
| idea from Nebulit-GmbH/agentic-engineer@07b0f30:.claude/skills/eventmodeling-orchestrating-event-modeling/SKILL.md, written independently: a self-catch prompt against cutting corners; a phase transition protocol | `SKILL.md` "Completeness over economy", `phases.md` |

## 3. Method lineage

- Event Modeling: Adam Dymitruk (eventmodeling.org): the four patterns, the workshop steps,
  information completeness.
- Understanding Eventsourcing: Martin Dilger. Practitioner guidance: Oskar Dudycz, Dennis Doomen,
  Greg Young, Mathias Verraes, Alberto Brandolini.
- Screenplay and Stage strategy: the model-first principles and rejected anti-patterns in
  `principles.md` come from the Cratis Screenplay roadmap and strategy decisions, written for this
  corpus.
- Phase gates, verdicts V1-V5, identity ownership, source identity, handoff packet and STATE.md are
  Cratis-specific constructions.
