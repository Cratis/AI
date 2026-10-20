---
id: 149
title: Let a project route the Screenplay lifecycle through its own decision, work-item and acceptance process
status: accepted
stage: none
class: contract
reversibility: costly
decided: 2026-10-18
decider: woksin (maintainer)
applies-to:
  - ".cratis/ai/skills/cratis-screenplay-modeling-lifecycle/**"
  - ".cratis/ai/agents/screenplay-*.md"
  - ".cratis/ai/rules/general.md"
  - ".cratis/ai/skills/cratis-engineering-decision-record/**"
issues: [514]
---

## Context

The Screenplay lifecycle assumes one process: decisions in `decisions/`, follow-ups as issues, one user who both confirms a model's meaning and commits it, and no project-specific agent instructions. Projects that already run their own decision store, backlog and acceptance roles, or that keep a committed model as generated evidence while migrating to model-first, had no supported way to say so. Without a seam they either fork managed corpus files, which `cratis ai update` refuses to overwrite, or the agents ignore the project's process.

`.cratis/ai.json` is project-owned and the CLI preserves unknown top-level keys: `AiCorpusSynchronizer.WriteConfiguration` parses the existing document and sets only the keys it owns.

## Decision

A project may add two optional keys to `.cratis/ai.json`; absent keys leave behavior exactly as before, and phases and verdicts do not change.

1. `modelFirst.frozen` (boolean, optional `reason`) marks a committed model as generated evidence. `model-first-status.mjs` reports it as not opted in with reason `frozen-model`, `contract` null and the committed files still listed. It overrides a configured root. A non-boolean value exits 2 (could not run), like a malformed root. Agents edit or regenerate a frozen `.play` only when the request names that `.play` path or model; a generic "regenerate all" skips frozen models and says so.
2. One `process` block carries `decisions` (`path`, `id`), `workItems` (`path`), `acceptance` (`meaning`, `commit` roles) and `agents` (addenda files per Screenplay agent). Only agents read it; the script echoes the resolved block with defaults. No tool enforces it.
3. Split acceptance is recorded in commit trailers, `Model-Meaning-Accepted-By: <role>: @<handle> (<language>) at <source-identity>` and `Model-Committed-By: <role>: @<handle>`, and mirrored on the STATE.md Acceptance line. Either acceptance without the other leaves P6 open; the committed digest must still equal the P5 digest.
4. Model notes remain the record of truth for open questions. A project may mirror them as OPEN records in its decision store, linked by id through `refs`.
5. Addenda apply to the Screenplay agents only (`screenplay-modeler`, `screenplay-reviewer`, `screenplay-renderer`). They may narrow behavior and never widen tools, make the reviewer writable, or weaken protection, gates, independence or verdicts. There is no corpus-wide convention.
6. `general.md` "Model first" lists a committed model the project marks frozen as not opt-in, inside its existing line.

## Options considered

- **Marker inside the model root** (a `screenplay.json` key or a `FROZEN` file). It travels with the model, but the status script and the CLI would have to learn a second configuration location, and `cratis screenplay mcp` would still not read it. Not taken.
- **Leave `general.md` unchanged and let the script be the only authority.** Costs nothing in always-loaded bytes but leaves `general.md` contradicting the script for frozen projects. Not taken.
- **Top-level `decisions` and `workItems` keys, not specific to Screenplay.** The decision-record skill is generic, but a single `process` block keeps one place to read and avoids claiming a convention beyond the lifecycle. Not taken.
- **Roles only in acceptance trailers.** Avoids handles, but a role alone names nobody to ask. Handles are recorded alongside roles.
- **Corpus-wide `process.agents` convention in `general.md`.** Costs always-loaded bytes for agents that never read addenda. Not taken.
- **Malformed `frozen` falls back to the default**, as `allowDependencyManifestWrites` does. A silent fallback would turn a typo into model-first work on evidence, so it is blocked instead.

## Default if unanswered

A project without the keys keeps today's behavior: a committed model opts in, decisions go to `decisions/`, a follow-up is an issue, one user confirms and commits, and no addenda load. The cost is that a project with its own process keeps working around the corpus by hand.

## Timeline and scope

Holds from the first release carrying it. In scope: the status script, the lifecycle skill and its references, the three Screenplay agents, and the decision-record skill's folder pointer. Out of scope: the `cratis screenplay mcp` server reading `frozen`, enforcement of the `process` keys by any tool, and the "Project-Specific Instructions" wording in `general.md` and `ai-distribution.md`.

## Verification

Done when: `model-first-status.mjs` reports `frozen-model` for a frozen committed model, exits 2 for a non-boolean value and echoes the resolved `process` block; the lifecycle skill, `references/project-process.md` and the three agents carry the clauses above.

Verify by: `yarn workspace @cratis/ai-verification run test` (the frozen and process specs in `model-first-status.spec.ts`), `node .cratis/ai/skills/cratis-screenplay-modeling-lifecycle/scripts/model-first-status.mjs --self-test`, and `yarn workspace @cratis/ai-verification run verify`.

## Consequences

Projects can connect the lifecycle to their own records and roles without forking the corpus. A frozen model cannot be changed by a generic bulk request. The `process` keys are advisory: a project relying on them depends on agents reading them. `general.md` grows by one clause, and the status script's JSON gains `frozen`, `frozenReason` and `process` fields.
