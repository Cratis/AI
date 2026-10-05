# Provenance

Sources are pinned. TrogonStack/agentskills is MIT, Copyright (c) 2025 Straw Hat, LLC (full
notice in this skill's `LICENSE`). Nebulit-GmbH/agentic-engineer has no licence: its material
is recorded as ideas written independently, with no text reused beyond a short phrase.
Event Modeling practice (Adam Dymitruk, Martin Dilger) is cited as practice; no text taken.

| Item | Source | Licence | Treatment | Where in this skill |
|---|---|---|---|---|
| Interview phase layout (skip condition, critical questions with impact and follow-up, interview flow) | TrogonStack/agentskills@7b249d3:plugins/trogonstack-eventmodeling/skills/eventmodeling-{storyboarding-events,identifying-inputs,identifying-outputs,designing-event-models}/SKILL.md | MIT | ADAPT closely; questions rewritten for Screenplay | SKILL.md *Interview phase* |
| Per-command specifics: source, inputs, validation, preconditions, success, each failure result | TrogonStack/agentskills@7b249d3:.../eventmodeling-identifying-inputs/SKILL.md (workflow 3) | MIT | ADAPT closely; failures become inventory rows with layer and spec | references/command-inventory.md |
| Conditional input pattern | same, *Conditional Input Pattern* | MIT | ADAPT: granularity question, implication rule | SKILL.md step 3; command-inventory.md |
| Common mistakes and quality checklists (screens, inputs, outputs, slices, design) | TrogonStack/agentskills@7b249d3:.../eventmodeling-{storyboarding-events,identifying-inputs,identifying-outputs,slicing-event-models,designing-event-models}/SKILL.md | MIT | ADAPT closely; merged into one Gate | SKILL.md *Gate*; command-inventory.md |
| Event versus read model test and recalculated-state anti-pattern | TrogonStack/agentskills@7b249d3:.../eventmodeling-identifying-outputs/SKILL.md | MIT | ADAPT; decided calculations stay facts | SKILL.md steps 4-5 |
| Slice dependency record (events consumed, producing slice) | TrogonStack/agentskills@7b249d3:.../eventmodeling-slicing-event-models/SKILL.md | MIT | ADAPT as a table | references/slicing.md |
| Slice shape read model, screen, command, event; a screen acting on an instance needs a view; no screen per persona for symmetry; no empty placeholder screen | idea from Nebulit-GmbH/agentic-engineer@07b0f30:.claude/skills/eventmodeling-storyboarding-events, eventmodeling-identifying-outputs, written independently | none | IDEA | SKILL.md step 7 |
| Reason line per contributing event; build lineage from files, not memory; per-element results | idea from Nebulit-GmbH/agentic-engineer@07b0f30:.claude/skills/eventmodeling-identifying-outputs, written independently | none | IDEA | SKILL.md step 8; references/field-lineage.md |
| Next-slice heuristic: explicit request wins, act on a wrong guess, say why | idea from Nebulit-GmbH/agentic-engineer@07b0f30:.claude/skills/add-next-slice, written independently | none | IDEA | references/slicing.md *The next slice* |
| Per-hop chain report (updated, skipped with reason) | idea from Nebulit-GmbH/agentic-engineer@07b0f30:.claude/skills/attributes, written independently | none | IDEA | references/field-lineage.md |
| Generic-edit ban, rule coverage, state-transition table, rule layers, refusal inventory, worked example | Cratis/AI corpus (original) | MIT | original | references/*.md |
