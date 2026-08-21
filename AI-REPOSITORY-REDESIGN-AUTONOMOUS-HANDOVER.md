# Cratis AI Repository Redesign Autonomous Handover

**Prepared:** 2026-08-20
**Status:** Canonical operational entry point for the full redesign program
**Authority:** The maintainer requested autonomous continuation across the complete program
**Plan:** [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-PLAN.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-PLAN.md)
**Prompt:** [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md)

## 1. Purpose

This handover replaces the prior continuation handover as the operational entry point. Earlier redesign handovers, plans, prompts, and reevaluation remain decision history and evidence. They must not be used to restore the old PR-2 scope or the original same-repository release-branch recommendation.

The next session is authorized to continue the entire program autonomously, including technical/product decisions, source movement, manifests, packages, repositories, commits, pull requests, release work, and rollout when the applicable gates pass. The executor must preserve security, legal, external-credential, product-owner, and destructive-operation boundaries defined below.

## 2. Required read order

Read completely before editing:

1. this handover;
2. `AI-REPOSITORY-REDESIGN-AUTONOMOUS-PLAN.md`;
3. `AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md`;
4. `AI-REPOSITORY-REDESIGN-ECOSYSTEM-USE-CASES.md`;
5. `AI-REPOSITORY-REDESIGN-THIRD-PARTY-SKILLS-EVALUATION.md`;
6. `AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md`;
7. `AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md`;
8. `AI-REPOSITORY-REDESIGN-REEVALUATION.md`;
9. `Documentation/public-product-architecture.md`;
10. `Documentation/project-context-bootstrap.md`;
11. `Documentation/redesign-foundation-validation.md`;
12. catalog v1/v2 schemas, data, validators, generators, and specs;
13. current bodies/comments of `.github#24`, Workflows#68, AI#126, and AI#127;
14. repository/project instructions and any newer accepted authority.

External authority order remains:

1. accepted organization ownership/migration decisions;
2. current maintainer direction and merged repository policy;
3. authoritative product repositories and official ecosystem specifications;
4. evidence-backed program recommendation;
5. historical unmerged handovers.

## 3. Maintainer direction now accepted for execution

Proceed with **Option A+**:

- `Cratis/AI` remains the sole canonical authoring/composition/evaluation source;
- a dedicated automation-managed public distribution repository is generated from exact approved content;
- the mixed AI repository is never installable;
- the generated repository is bot-owned and not manually authored;
- immutable releases, npm packages, wrappers, and marketplaces derive from one staged logical tree;
- use a separate manually authored public product repository only if generated distribution cannot satisfy real host governance;
- Workflows owns promotion, canary, pinning, rollback, emergency disable, and propagation retirement.

The maintainer also authorized autonomous execution of the overall program. Record these decisions on Workflows#68 and related authority records before publication. Do not infer that autonomy permits bypassing vendor credentials, protected environments, legal review, product-owner approval, or destructive production authorization.

## 4. Product conclusion

The public product must not be a C#/Arc/Chronicle-only bundle. It needs a language-neutral core plus product, language, architecture, persona, surface, and trust overlays.

First-class coverage includes:

- Chronicle-only .NET, Kotlin, Java, Elixir, and TypeScript;
- Arc-only commands, queries, validation, authorization, and EF;
- Arc React, MVVM, Components, and Arc+Chronicle compositions;
- CLI, terminal/browser Workbench, operations, and Chronicle.Mcp guidance;
- event modeling, Screenplay, Stage, and public Studio workflows;
- external contributors, Cratis maintainers, consultants, client repositories;
- product owners, domain experts, QA, support, operators, architects, and compliance;
- GUI, browser, IDE, terminal, CI, MCP, and Pi use.

The current 35 public candidates are a useful source inventory, not ecosystem-wide release coverage.

## 5. Third-party conclusion

The complete audits found:

### Matt Pocock skills

- commit `0ab1b63a410a03d3627979a109c8695de27af954`;
- 25 promoted skills;
- MIT, copyright Matt Pocock;
- strong invocation, composition, docs, dependency, diagnosis, review, and modeling patterns;
- unsafe/conflicting wholesale behavior around project setup, tracker/Git mutations, recursive agents, automatic commits, merge policy, scripts, and updates.

### pstack

- `cursor/plugins` commit `51a96e0dd838404da19ba83dc70aa21eef71f868`, subtree `pstack/`;
- 44 skills, two agents, playbooks, runtime scripts, and dormant automation;
- MIT, copyright Lauren Tan;
- strong real-artifact evidence, confidence, review, verification, and fail-closed patterns;
- Cursor/model/transcript/Graphite/Bun/control-plane assumptions and broad autonomy make it unsuitable for wholesale Cratis/Pi use.

Decision:

- no vendoring, mirroring, forking, transitive installation, or redistribution;
- optional direct upstream companions only;
- repository-only companion metadata with `bytesIncluded: false`;
- clean-room adaptation of selected requirement-level ideas;
- route orchestration/control/release/Chronicle execution to Ensemble, Stagehand, Workflows, and Chronicle.Mcp;
- no external payload in public or engineering Cratis packages.

## 6. Pi conclusion

Pi 0.84.2 packages natively declare extensions, skills, prompts, and themes. Project packages load after project trust.

Target artifacts:

- `@cratis/ai`: passive approved public skills only, no extensions/lifecycle scripts, exact npm allowlist;
- `@cratis/pi`: optional separately versioned executable Pi-native Cratis behavior only after security review;
- engineering Pi packages: separate trust/audience;
- Chronicle.Mcp remains the executable Chronicle owner; a Pi adapter must not duplicate its tools;
- do not install Matt’s repository or port pstack wholesale into Pi.

## 7. Completed foundation

Implemented and validated:

- catalog/schema v2 foundation;
- 43 sources, 43 targets, 42 migrations;
- evidence-bound ecosystem registry/claims;
- complete repository ownership inventory;
- strict unsupported-schema-keyword failure;
- fixture exact-allowlist materializer and adversarial archive/path/resource tests;
- recursive engineering-skill discovery leak fixture;
- project-context resolver/bootstrap fixtures;
- 36 Node specifications passing at the last foundation validation;
- strict JSON, corpus validation, scoped Markdown lint/links, LSP, diagnostics, diff check, and protected hash evidence.

No source was moved. No manifest/package/distribution repo/publication was created. No target is runtime-approved.

## 8. Current worktree checkpoint

Fresh checkpoint before creating this autonomous set:

- branch: `main`;
- local HEAD: `158bcabfcac1ac2042696c7f747436cf783c0482`;
- upstream: `origin/main` at `b795d5307e20f7f7458a67708b4f26975e223796`;
- divergence: local zero ahead, four behind;
- staged paths: zero;
- protected baseline: `/tmp/cratis-ai-autonomous-plan-baseline.uQ5WB8/protected-sha256.tsv` for the current process environment only.

Pre-existing modified tracked files remain protected:

- `.ai/hooks/agent-stop.md`;
- `.ai/hooks/pre-commit.md`;
- `.ai/hooks/scripts/validate-ai-setup.sh`;
- `.gitignore`;
- `Documentation/index.md`.

There are extensive untracked redesign/catalog/tooling files and `.pi` task/delegate/Fusion artifacts. Do not clean or treat `.pi` runtime output as policy. Record a fresh baseline because `/tmp` paths are not durable across sessions.

Do not pull, merge, rebase, reset, or switch branches until the fresh session has protected every change and chosen a safe branch/worktree strategy. Never absorb the five protected tracked changes into redesign commits without explicit classification and evidence.

## 9. Immediate next bounded scope

The next session starts with program Phase 0 and Phase 1:

1. protect/reconcile the worktree and remote divergence;
2. read and record current GitHub authority;
3. record Option A+ and autonomy direction on Workflows#68;
4. validate and persist this autonomous handover/plan/prompt plus research records;
5. extend catalog/schema v2 with invocation, capability kind, products/languages/personas/surfaces, trust/side effects, dependency strength, source contracts, bundles, and upstream companions;
6. create the Cratis skill-authoring and human-catalog contracts;
7. add validators/specs and update ownership inventory;
8. package the current foundation/decision work into reviewable branch/PR-sized changes while excluding protected work;
9. continue to Phase 2 without waiting if gates pass.

The executor is authorized to continue beyond this bounded scope through every later phase. Keep phases and PRs independently reviewable and update this handover after each one.

## 10. Autonomous operating rules

Proceed without asking for routine or reversible technical/product choices. Use conservative evidence-backed defaults and record decisions.

Ask or stop only when no safe path exists because of:

- unavailable secrets/credentials/organization membership;
- legal/vendor/human marketplace approval;
- conflicting accepted authority;
- destructive production/customer action;
- protected branch/history/repository deletion;
- unknown confidential/private-source rights;
- a product-owner decision that materially defines public behavior and cannot be inferred from authoritative product sources.

When blocked, record the exact missing input and continue every independent workstream.

## 11. Subagent and worktree strategy

Use subagents as the default for broad work:

- Repository Investigator and reviewer for evidence;
- specialized backend/frontend/spec/security/performance/code-review agents;
- Coordinator/Orchestrator for multi-concern phases;
- model-diverse identical-prompt reviews for contested designs;
- isolated worktrees for parallel writers and alternatives.

Rules:

- one writer per file/worktree/state item;
- no duplicate delegated work;
- children receive explicit paths, facts, boundaries, and acceptance criteria;
- bound recursion, fan-out, output, time, and cost;
- keep bulk evidence in child contexts;
- verify actual diffs/artifacts/tests before accepting summaries;
- do not let a subagent grant itself authority;
- preserve cross-session decision/evidence state in repository files.

## 12. Validation expectations

At each relevant phase:

- corpus validator;
- legacy and v2 catalog/schema validation;
- strict parsing and unsupported-vocabulary tests;
- all tooling/spec suites;
- public artifact materializer/adversarial tests;
- skill behavior/positive/negative/collision evaluations;
- product-language compilation or behavior checks where practical;
- security/performance review for relevant risk;
- LSP/lint/link/session diagnostics;
- package/unpacked-artifact validation;
- installation/update/rollback smoke tests;
- protected hash/status/diff check;
- honest unavailable-validator record.

Do not call a schema/catalog check plugin, package, marketplace, behavioral, or release conformance.

## 13. Cross-session durability

Before context exhaustion, phase completion, or handoff:

- update this file with branch/commit/PR/issue/task state;
- update plan checkboxes/status or add an execution ledger;
- record decisions and rejected alternatives;
- record validation commands/outcomes and protected hashes;
- record blockers and exact next actions;
- ensure the autonomous prompt remains valid;
- never leave critical state only in a transcript, task output, or `/tmp` file.

## 14. Resume instruction

Execute the complete prompt in:

- [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md)

It is intended to be pasted unchanged into a fresh session. It authorizes continuation through the complete program, not only one pull request.

## 15. Autonomous execution update — 2026-08-20

### Authority and repository strategy

Option A+ and the autonomous execution authority are now recorded in the
organization authority records:

- [`Cratis/Workflows#68` decision comment](https://github.com/Cratis/Workflows/issues/68#issuecomment-5363284054);
- [`Cratis/.github#24` program comment](https://github.com/Cratis/.github/issues/24#issuecomment-5363284173).

No newer issue or pull request contradicted that decision. `Cratis/AI` had no
open pull request when the execution baseline was captured. Workflows#68 remains
open for implementation, canary, version/override policy, rollback, wrapper
retirement, and lifting the live freeze.

The protected main worktree is now aligned with `origin/main` at
`b795d5307e20f7f7458a67708b4f26975e223796`, with zero divergence. Work proceeds
in the sibling isolated worktree `../AI-autonomous-redesign` on branch
`feat/autonomous-redesign-foundation`. The dirty main worktree is not
switched, merged, reset, rebased, staged, or cleaned.

### Protected baseline

The durable baseline is in
[`Documentation/evidence/redesign-autonomous-execution-2026-08-20/`](./Documentation/evidence/redesign-autonomous-execution-2026-08-20/README.md).
It records every staged, unstaged, untracked, and ignored path and SHA-256 for
all 276 pre-existing changed paths. The five protected tracked files remain:

- `.ai/hooks/agent-stop.md` — `6e7dfe33c9600a83989dfd9bacdb5473f9980c07bc4fcb8fb0083bdd63d18c6a`;
- `.ai/hooks/pre-commit.md` — `66c8576c47f560a78b41d6a17782a08e891b79f7048577c29cbb5d5da6d7cc05`;
- `.ai/hooks/scripts/validate-ai-setup.sh` — `f9d6bdffe0571ac7aa6ad5800f9d0c8811560e256dcb32225ada7a919fd13c7f`;
- `.gitignore` — `935d04efd7e11bb25d292216d586547e9db972d70cb01dc3151c217f39dcbe19`;
- `Documentation/index.md` — `4c99b605de94afacf09401cb6c696934580f3e220b9f7bafd00f2011498651ab`.

### Foundation correction and validation

The foundation generator is now based on the current immutable source revision,
the catalog records the accepted Option A+ architecture and comment evidence,
and source content digests are checked against both current bytes and the exact
revision tree. Local evidence is path-and-digest bound. Repository inventory now
records a base revision, its complete change set, and a self-excluding index
digest rather than claiming staged additions existed at the base revision.
Live materialization remains disabled because no target is approved.

Independent review found and the branch corrected runtime-eligibility approval
bypass, dangling evidence references, archive resource exhaustion, invalid
UTF-8 and common secret/private-address gaps, and partial output after late
validation failure. The repository now has a pinned local pull-request
verification workflow.

Fresh isolated-worktree signals:

- AI corpus validator: passed with the same three historical advisories;
- catalog validation: passed;
- Node specifications: 47/47 passed;
- source revision, digest, closure, and evidence regressions: passed;
- accepted-architecture and independent runtime/materialization gates: passed;
- bounded and cleanup-safe fixture archive/materializer regressions: passed;
- repository inventory: 35 groups over 387 tracked paths, zero admitted
  untracked paths, and 74 base-revision changes;
- Markdown lint: zero findings across 30 files;
- external link validation: passed;
- primary LSP diagnostics: zero findings;
- protected non-`.pi` baseline comparison: 62/62 unchanged;
- no plugin, package, release, marketplace, or runtime conformance is claimed.

### Active autonomous work

The initial Claude specialists failed with provider HTTP 429 limits. Broad and
focused read-only product delegates then exhausted their tool budgets without a
committed conclusion. Those failures grant no evidence and changed no source.
Product-source coverage will resume through smaller bounded repository reads;
no unsupported client/product claim is accepted from failed tasks. The
immediate delivery order is:

1. land the autonomous authority/research/foundation record without protected
   work;
2. extend catalog/schema v2 with normalized dimensions, trust/effects,
   dependency strength, source contracts, bundles, and upstream companions;
3. add the Cratis-original skill-authoring and generated human-catalog
   contracts;
4. implement and evaluate clean-room navigator, diagnostics, review, and
   event-modeling pilots;
5. continue through the remaining autonomous plan phases.
