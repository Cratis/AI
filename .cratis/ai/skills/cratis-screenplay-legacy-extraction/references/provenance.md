# Provenance

| Content | Source | Licence | How used |
|---|---|---|---|
| Interview protocol (critical questions, follow-up triggers, interview flow, findings capture, green-light checklist) in `SKILL.md` and `references/interview-findings.md` | TrogonStack/agentskills `plugins/trogonstack-eventmodeling/skills/eventmodeling-integrating-legacy-systems/SKILL.md` at `7b249d3ee42d8b7e11fa564141ebd5fbc37aadf1` | MIT, Copyright (c) 2025 Straw Hat, LLC (notice in `LICENSE`) | Adapted closely: questions restructured around Screenplay extraction, the Cratis toolchain and the approval rules; the freeze question kept as the first gate |
| Freeze agreement, side-car pattern, extraction options, traffic routing phases, integration patterns, anti-patterns, quality checklist in `references/side-car-migration.md` | same file | MIT (as above) | Adapted: the target store is Chronicle, extraction is a code or Prologue concern, and the new behaviour is authored as a Screenplay model; the dual-write exception and its controls are kept |
| Evidence ladder, locators, loss report, unknowns, generator/Prologue coverage notes, rule modeling, signal-to-intent table, `references/intent-example.md` | Cratis/AI corpus drafts for this issue (#493), written for Cratis | MIT (Cratis) | Own work |
| Bounded, state-aware UI walk in `references/ui-observation.md` | idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/discover-storyboard/SKILL.md`, written independently | Repository without a licence: ideas only, own words | Journey-first order, meaningful-transition detection, before/after states and a sampling budget; board placement and HTML reconstruction are not adopted |

Verified product facts are listed under *Verified product sources* in `SKILL.md`.
