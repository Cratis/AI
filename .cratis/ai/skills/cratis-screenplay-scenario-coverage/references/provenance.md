# Provenance

Lineage of `cratis-screenplay-scenario-coverage`. The method was first drafted for the Cratis
corpus from Screenplay specification semantics (verified at tag v4.64.0) and refined against two
external event-modeling skill sets.

## Adapted closely (MIT)
Source: TrogonStack/agentskills at `7b249d3ee42d8b7e11fa564141ebd5fbc37aadf1`, MIT, Copyright (c)
2025 Straw Hat, LLC. Full notice in this skill's `LICENSE`.

| Source path | Adapted into | How |
|---|---|---|
| `plugins/trogonstack-eventmodeling/skills/eventmodeling-elaborating-scenarios/SKILL.md`, Interview Phase and Critical Questions | `SKILL.md` "Interview phase" | Skip condition and four critical questions kept in structure (coverage depth, known edge cases and rules, how scenarios will be used, who reviews); rewritten for Screenplay specifications, the coverage matrix and unattended assumptions |
| same file, Workshop Facilitation Guide (Before the Workshop, During per command and view, Multi-Role Review, Common Workshop Mistakes, Tips for Rapid Creation) | `references/scenario-workshop.md` | Structure and the six-step per-command cycle adapted; steps extended to the full scenario catalogue; time-boxes and per-command quotas deliberately dropped because they conflict with obligation-driven coverage |
| same file, Quality Checklist and Gherkin Best Practices (explicit givens, explicit outcomes, named reasons) | `SKILL.md` "Quality checklist" | Mapped onto `.play` specification style (exact events, pinned messages, `for`, one behaviour per spec) |
| same file, Scenario Organization (happy path, validation, state violation, duplicates, alternatives, error handling, compensation) | `references/scenario-catalogue.md` ordering | Extended with denial, competing claim, ordering, evolution and view types |

## Ideas written independently
- Idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/examples`, written
  independently: neighbourhood-first, non-destructive example data, and varying only the field
  the rule under test checks. In `references/scenario-catalogue.md` "Example data".
- Idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/eventmodeling-elaborating-scenarios`,
  written independently: contrast of given/when/then specifications with storyline-style
  scenarios. In `references/view-and-story-specs.md` (lifecycle families).

## Cratis-original
Coverage matrix and obligation derivation from declarations, cell vocabulary (`spec`, `n/a`,
`recorded`, `open`, `question`, `gap`), scenario types per Screenplay semantics, denial fixtures
from the Boolean gate, "once, idempotent, exactly once" separation, view lifecycle families,
Chronicle verification obligations, version skew for reaction cascades, spec forms per mode, and
the berth reservations example.

## Product facts checked
- Screenplay v4.64.0 (`7e16162`): `Documentation/screenplay/specifications.md` (actions, outcomes,
  `then denied`, `then no readmodel`, `then query`, `then events in any order`, PLAY0352,
  PLAY0389) and the probes recorded in the version table of `cratis-screenplay-toolchain`
  `references/versions.md`.
- Screenplay#390 (specification obligations in MCP) and #394 (multi-step specifications) were
  open when written: cited as not available.
- Stage v4.24.0: `STAGE-ESM-015` and `STAGE-ESM-011` admission diagnostics for policies and
  fixtures (`Documentation/guides/build-renderer-target.md`).
