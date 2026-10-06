# Provenance

Sources are pinned. TrogonStack/agentskills is MIT, Copyright (c) 2025 Straw Hat, LLC (full
notice in this skill's `LICENSE`). agentic-engineer by Martin Dilger and Nebulit GmbH carries no licence file; its material is adapted with
the agreement of Martin Dilger and Nebulit GmbH (see *Adapted closely* below).
Event Modeling practice (Adam Dymitruk, Martin Dilger) is cited as practice; no text taken.

| Item | Source | Licence | Treatment | Where in this skill |
|---|---|---|---|---|
| Interview phase layout (skip condition, critical questions with impact and follow-up, interview flow) | TrogonStack/agentskills@7b249d3:plugins/trogonstack-eventmodeling/skills/eventmodeling-{storyboarding-events,identifying-inputs,identifying-outputs,designing-event-models}/SKILL.md | MIT | ADAPT closely; questions rewritten for Screenplay | SKILL.md *Interview phase* |
| Per-command specifics: source, inputs, validation, preconditions, success, each failure result | TrogonStack/agentskills@7b249d3:.../eventmodeling-identifying-inputs/SKILL.md (workflow 3) | MIT | ADAPT closely; failures become inventory rows with layer and spec | references/command-inventory.md |
| Conditional input pattern | same, *Conditional Input Pattern* | MIT | ADAPT: granularity question, implication rule | SKILL.md step 3; command-inventory.md |
| Common mistakes and quality checklists (screens, inputs, outputs, slices, design) | TrogonStack/agentskills@7b249d3:.../eventmodeling-{storyboarding-events,identifying-inputs,identifying-outputs,slicing-event-models,designing-event-models}/SKILL.md | MIT | ADAPT closely; merged into one Gate | SKILL.md *Gate*; command-inventory.md |
| Event versus read model test and recalculated-state anti-pattern | TrogonStack/agentskills@7b249d3:.../eventmodeling-identifying-outputs/SKILL.md | MIT | ADAPT; decided calculations stay facts | SKILL.md steps 4-5 |
| Slice dependency record (events consumed, producing slice) | TrogonStack/agentskills@7b249d3:.../eventmodeling-slicing-event-models/SKILL.md | MIT | ADAPT as a table | references/slicing.md |
| Generic-edit ban, rule coverage, state-transition table, rule layers, refusal inventory, worked example | Cratis/AI corpus (original) | MIT | original | references/*.md |

## Adapted closely (Martin Dilger and Nebulit GmbH, with agreement)

Source: https://github.com/Nebulit-GmbH/agentic-engineer at commit `07b0f30648d663cb588d7e2c7aa031af9dfc21f2`,
by Martin Dilger and Nebulit GmbH (https://nebulit.de). The repository carries no licence file; this material
is adapted with the agreement of Martin Dilger and Nebulit GmbH.

| Source file | Used in | How |
|---|---|---|
| `.claude/skills/eventmodeling-storyboarding-events/SKILL.md`, `eventmodeling-identifying-outputs/SKILL.md`: slice shape `READ MODEL -> SCREEN -> COMMAND -> EVENT`, command screens need a view, blank creation form the only exemption, no empty placeholder screen | `SKILL.md` steps 6-7, `references/read-model-design.md` "The typical slice pattern" | adapted closely; board layout dropped |
| `eventmodeling-storyboarding-events`: no screen per persona for symmetry; one actor's view | `SKILL.md` step 7, `references/review-questions.md` | idea; our own wording kept |
| `eventmodeling-identifying-outputs/SKILL.md`: events vs read models test, recalculated-state anti-pattern, processor outputs categorized (new event, view update, notification) | `references/read-model-design.md` "Events or views" | adapted closely; the "independent means event" and "no computed fields" rows dropped because decided calculations are facts in Screenplay |
| `eventmodeling-identifying-outputs/SKILL.md` Step 5a/5c: enumerate consumers, one component one read model, homogeneous list is one component, wide-fan-in versus cheap fields | `references/read-model-design.md` "Components" | adapted closely; "always split" softened to "split when you can name the consequence" (existing decision); screen copies become one `data` line per component |
| `eventmodeling-identifying-outputs/SKILL.md` Step 5d: build read models from the screen's field mappings, not from its title or a summary | `references/read-model-design.md` "Components"; `references/field-lineage.md` | adapted closely |
| `eventmodeling-identifying-outputs/SKILL.md` Step 5h.4, 5i: event-to-field reasoning note, per-node verification result list | `SKILL.md` step 8; `references/read-model-design.md` "Checks before handing off"; `references/field-lineage.md` | adapted closely; the note lives in the StateView slice `description` |
| `eventmodeling-identifying-outputs/SKILL.md` lines 378-379: before completion re-read every read model and recheck each field and every reason note (roll-ups, additions) | `references/read-model-design.md` "Checks before handing off" | adapted closely; Cratis named-consequence threshold kept instead of "always split" |
| `eventmodeling-identifying-outputs/SKILL.md` Interview: calculated fields confirmation wording | `SKILL.md` *Interview phase* question 3 | adapted closely |
| `eventmodeling-identifying-inputs/SKILL.md`: automation level and outside-trigger questions, user versus processor commands marked, conditional input pattern, processor failure/retry stated | `SKILL.md` *Interview phase* question 1; `references/command-inventory.md` | adapted closely; `[USER]`/`[AUTO]` kept as plain classification |
| `eventmodeling-identifying-inputs/SKILL.md`: per-command source, inputs, validation, preconditions, success, failures | `references/command-inventory.md` | translated to Screenplay (refusal inventory with layers); `session:` mappings rejected (caller identity is context) |
| `eventmodeling-slicing-event-models/SKILL.md`, its slicing patterns file: slice per command, view or automation; events-only dependencies; slice definition template (produces, consumes, upstream, downstream); name after the element | `references/slicing.md` "Slice dependencies" | adapted closely; board slice-definition calls dropped |
| `add-next-slice/SKILL.md`: never stop at a comment, a wrong guess is cheap, derive next capability from the story, unaddressed affordance, report what and why | `references/slicing.md` "The next slice"; `SKILL.md` step 9-10 | adapted closely; the CRUD gap hint corrected so a correction names what it corrects |
| `attributes/SKILL.md`: skip and log per hop, hop report naming the chain | `references/field-lineage.md` "Adding or renaming a field" | adapted closely; board cell walk dropped, identity-aware path kept |
| `eventmodeling-designing-event-models/SKILL.md`: events as past-tense business facts, causality, state transitions | `SKILL.md` step 4; `references/slicing.md` state-transition table | idea; our own wording kept (our table is stricter) |
| `storyboard-screen/SKILL.md`, `html-screen/SKILL.md`, `place-element/SKILL.md` | none | not adopted: board and HTML rendering mechanics; screen field mapping `derived:` already in `references/field-lineage.md` |
| `.build-kit/.slices/restaurant/*/slice.json` | none in this skill | patterns only; passed to scenario coverage (spec example values that vary one rule) |
