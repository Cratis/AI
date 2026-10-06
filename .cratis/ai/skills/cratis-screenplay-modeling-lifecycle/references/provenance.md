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
2. **Adapted closely (Martin Dilger and Nebulit GmbH, with agreement).** One row per item taken from Martin Dilger and Nebulit GmbH's
   agentic-engineer: source file, where it is used, how. Mark "idea; our wording kept" where only
   the idea was taken. The skill `LICENSE` carries the Nebulit notice.
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

## 2. Adapted closely (Martin Dilger and Nebulit GmbH, with agreement)

Source: https://github.com/Nebulit-GmbH/agentic-engineer at commit `07b0f30648d663cb588d7e2c7aa031af9dfc21f2`,
by Martin Dilger and Nebulit GmbH (https://nebulit.de). The repository carries no licence file; this material
is adapted with the agreement of Martin Dilger and Nebulit GmbH.

| Source file | Used in | How |
|---|---|---|
| `.claude/skills/eventmodeling-orchestrating-event-modeling/SKILL.md`: "Do not cut corners to save tokens or effort" (forbidden rationalizations, self-catch trigger, flag trade-offs to the user) | `SKILL.md` "Do not cut corners to save tokens or effort", `references/completeness-self-check.md` | Adapted closely; restored from #493. Board rationalizations (delete a node to dodge a placement conflict, "session-context" read model, collapsed translation chain) translated to Screenplay (modeled reaction, missing view, translation merged into worker behavior, denial and protection) |
| same file: "Phase Transition Protocol" (what was done, carry-forward, open questions; trail row to Done) | `SKILL.md` "Lifecycle", `references/phases.md` "Phase transition protocol" | Adapted closely; restored from #493. Memory file replaced by STATE.md |
| same file: "Documenting decisions inline" and Step 11 "What the note should actually contain" (cold reader, simple chapter stays brief) | `references/reasoning-notes.md` | Adapted closely; restored from #493. Feedback-lane note translated to a `description`; counts and verdicts stay in STATE.md |
| same file: "Interview Phase" and "Mid-Workflow Entry" | `SKILL.md` "Interview phase (P0)" | Already adapted from TrogonStack (section 1); Martin Dilger and Nebulit GmbH's confirmation sentence kept |
| `.claude/skills/eventmodeling-interview-protocol/SKILL.md`: "When to ask", "Unless told not to ask", "Recording the outcome" | `references/stop-or-assume.md` "Interview protocol" | Adapted closely; restored from #493. Interview file replaced by the STATE.md Interview Trail |
| `.agent-modeling-kit/CLAUDE.md`: per-turn steps (screen the prompt, connect once, resolve context, start marker, invoke the matched skill never raw calls, questioning rule, close, learnings) | `references/per-turn-protocol.md`, `SKILL.md` "Run protocol" | Adapted closely; restored from #493. Board prompts and status calls translated to briefs, `Active:` in STATE.md and the `Outcome:` line; `<promise>` sentinels, `progress.txt` and learnings promotion not adopted |
| `.agent-modeling-kit/AGENTS.md`: diagnose why a command failed before retrying it | `references/per-turn-protocol.md` step 5 | Adapted closely, restored; unknown-outcome MCP applies are never retried (toolchain trap 42) |
| orchestrating `SKILL.md`: cross-context and integration gaps stated with the finding and the viable resolutions, matching the posted question | `references/reasoning-notes.md` item 6 | Adapted closely; the comment becomes an open question or STATE.md decision |
| `.agent-modeling-kit/CLAUDE.md`: "never leave a prompt neither progressed nor closed" | `SKILL.md` "Run protocol", `references/stop-or-assume.md` | Idea; our wording kept |
| `.claude/skills/request-feedback/SKILL.md`: when escalation applies and when it does not; do not guess and build anyway; write the question for a cold reader | `references/stop-or-assume.md`, `references/handoff-template.md` section 4 | Idea; our wording kept (question format, calibration) |
| `.claude/skills/update-prompt-status/SKILL.md` and kit "exactly two status updates per prompt" | `references/per-turn-protocol.md` step 7 | Idea; one start marker and one closing outcome per turn, our wording |
| `.claude/skills/eventmodeling-core-rules/SKILL.md`: modeling and critic postures never mixed; a known refusal is a documented rule | `SKILL.md` "Modes", "Do not cut corners to save tokens or effort" | Idea; our wording kept |
| `.claude/skills/connect/SKILL.md`: discover capabilities once per session | `SKILL.md` "Run protocol", `references/identity-and-edits.md` | Idea; our wording kept |

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
