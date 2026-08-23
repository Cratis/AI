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

## 16. Capability-model checkpoint — 2026-08-21

### Merged foundation

Pull request [`Cratis/AI#130`](https://github.com/Cratis/AI/pull/130) merged with
merge commit `569d478efb3ad64b77ed65c4e60dfab39f97695d`. Its CI passed and the
`no-release` label correctly produced no package or product release. AI#126 and
Workflows#68 remain open with comments that record what landed and what remains.
The foundation branch and worktree were removed through normal merged-branch
cleanup; the protected dirty main worktree remains untouched.

### Active isolated branch

Work now continues in `../AI-capability-model` on
`feat/catalog-v2-capability-model`, based on the merged foundation. The active
scope is a safety-local hybrid inside catalog v2:

- authored closed taxonomy;
- authored product/client source contracts that start unverified;
- explicit non-publishable review bundles;
- upstream companion metadata with `bytesIncluded: false`;
- target-local capability kind, invocation, lifecycle, applicability, trust,
  effects, dependency classification, and source-contract fields;
- semantic validators and regression specifications;
- capability-model documentation.

The migration deliberately uses `unclassified` for decisions that do not yet
have reviewed evidence. It does not infer architecture, persona, surface,
invocation, dependency strength, effects, or product authority from legacy
names. All 43 targets remain candidates and runtime-ineligible.

### Current uncommitted delivery state

New authored files:

- `catalog/v2/taxonomy.json`;
- `catalog/v2/source-contracts.json`;
- `catalog/v2/bundles.json`;
- `catalog/v2/upstream-companions.json`;
- `Documentation/capability-catalog-v2.md`.

Modified source files include the v2 schema, generator, semantic validator,
repository-inventory generator, validation entry point, and catalog specs.
`tooling/catalog-ordering.mjs` and its specification now provide one
locale-independent ordering contract.

Two Fusion panels were reviewed. Their safety-local normalization, explicit
unassessed states, deterministic generation, and bounded audit principles were
accepted. Their proposed parallel Python toolchain, monolithic replacement
catalog, category-prefixed IDs, v3 cutover, and bundling of the authoring/human
catalog work into this pull request were rejected because they conflict with
the merged Node foundation, existing v2 IDs, and the accepted reversible PR
sequence.

Independent correctness review found authorization, non-target dependency,
migration-equivalence, source-authority proof/coverage, and optional-bundle
reachability gaps. Independent performance review found serial Git subprocess,
recursive cycle, quadratic membership, and locale-ordering risks. The active
branch now addresses all of them with authorization evidence, typed target/tool/
internal/project-context edges, inverse migration checks, product/subject source
coverage, reachable optional selection, revision snapshot batching, iterative
cycle detection, set membership, and ordinal ordering.

Current fresh signals:

- catalog validation: 3 legacy plus 11 v2 catalogs and 4 schemas passed;
- Node specifications: 56/56 passed in about 0.34 seconds after provenance
  batching, down from multi-second repeated subprocess validation;
- 43 targets remain candidates; zero are approved or runtime-included;
- 6 bundles remain draft and non-publishable;
- all source contracts remain unverified and distribution-disabled;
- both upstream companions retain `bytesIncluded: false`;
- Markdown lint, primary LSP, and documentation link validation passed before
  the latest review fixes and will be rerun at the delivery gate.

Exact next actions:

1. run focused security and correctness rereview over the closed review gaps;
2. regenerate the self-excluding repository inventory and run the complete
   validator/spec/LSP/lint/link/diff/protected-hash suite;
3. commit and push the coherent capability-model unit, open a separate
   `no-release` pull request, monitor CI, merge, and record the result;
4. start the separate skill-authoring and generated human-catalog contract PR.

## 17. Skill-authoring and human-catalog checkpoint — 2026-08-21

### Capability-model delivery

Commit `695e5e97b7be6c3bdf9ab9afedd9e7974abf27fb` landed through
[`Cratis/AI#131`](https://github.com/Cratis/AI/pull/131) with merge commit
`029de952811f0af07364a65651a7013875210436`. CI passed and `no-release`
correctly produced no package or product release. The local gate passed 56/56
Node specifications, catalog validation, generation drift checks, strict JSON
parsing, Markdown lint, links, LSP, actionlint, diff checks, and protected hash
comparison. Final independent rereview returned `CLEAR` before commit. AI#126
and Workflows#68 now record the partial completion. The merged branch/worktree
was removed through normal cleanup.

### Active authoring branch

The next unit is active in `../AI-authoring-catalog` on
`feat/skill-authoring-human-catalog`, fast-forwarded to merged `origin/main` at
`029de952811f0af07364a65651a7013875210436`. It does not author or approve
runtime skill bytes.

Implemented source so far:

- `catalog/v2/authoring-contracts.json` — active original-expression clean-room
  Agent Skill contract with source/evidence, payload, similarity, and quality
  requirements;
- `catalog/v2/human-catalog.json` — bounded, deterministic, offline generation
  contract that forbids runtime payload bytes and runtime-permission claims;
- `Documentation/skill-authoring-contract.md` — human authoring workflow and
  boundary explanation;
- `tooling/generate-human-catalog.mjs` — bounded deterministic JSON/Markdown/
  manifest generator with `--check`, manifest-last activation, and fault-tested
  recovery without removing the live output directory;
- `catalog/generated/human-catalog/` — generated metadata-only catalog for all
  35 public targets, visibly candidate/unclassified/runtime-ineligible, with
  engineering targets excluded from the public human surface;
- schema, semantic validation, CI, inventory, and specification updates.

Targets now carry an unclassified authoring-contract state. Approval will
require the active `cratis-skill-clean-room-v1` contract, in addition to all
existing source, trust, dependency, evaluation, security, and approval gates.
Generated views are navigation only and cannot become evidence, source
authority, authoring input, distribution input, or runtime payload.

Current signals:

- catalog validation: 3 legacy plus 13 v2 catalogs and 4 schemas passed;
- Node specifications: 66/66 passed after security and interruption tests;
- generated human catalog: 35 public targets, zero runtime-eligible, three manifested
  files, deterministic `--check`, stale-extra-file rejection, public-audience
  isolation, Markdown escaping, manifest-last activation, interruption, and
  recovery specifications passed;
- repository inventory: 39 groups over 402 tracked paths with authored and
  generated catalog surfaces separated;
- all target authoring-contract fields remain unclassified and approval now
  requires the active clean-room contract;
- no runtime skill source, package, plugin, or publication artifact exists.

Exact next actions:

1. run the complete generation-twice, `--check`, catalog/spec/LSP/lint/link/
   diff/actionlint and protected-hash gates;
2. run independent correctness, security, performance, and clean-room evidence
   review;
3. commit, push, open a `no-release` pull request, monitor CI, merge, and update
   this handover;
4. begin the separate clean-room navigator pilot and blind trigger/behavior
   evaluation unit.

## 18. Navigator pilot design checkpoint — 2026-08-21

A five-model reasoning panel produced the first clean-room pilot design. The
accepted bounded direction is one passive repository-only router that selects
the narrowest revision-bound target and never invokes it. It preserves
project-owned context, separates requested effect from target trust, asks at
most one route-changing clarification, emits one route by default and at most
five for explicitly separate tasks, and uses these fail-closed results:

- `ROUTE_SIMULATED` for a verified passive destination;
- `CLARIFY` for material route ambiguity;
- `BLOCKED_UNVERIFIED` for absent, stale, conflicting, or malformed evidence;
- `BLOCKED_EFFECT` for a verified executable destination because the pilot
  cannot execute;
- `REFUSE` for bypass, exfiltration, unsafe destruction, or self-promotion;
- `ABSTAIN` when Cratis intent is not established.

The pilot will live under repository-only `pilots/cratis-navigator/` with evals
under `evals/cratis-navigator/`, never under a runtime skill path. The planned
suite contains 12 positive routes, 16 difficult negatives/collisions,
application/framework/client/corpus fixtures, model-selected and explicit-user
conditions, baseline comparisons, held-out paraphrases, confusable terms,
project-context precedence, and zero-tolerance write/network/invocation/
secret-echo/unsupported-claim assertions. Promotion requires exact safety and
context results, at least 95% held-out routing behavior, deterministic repeated
runs, independent originality/security/portability review, and a separate
runtime-candidacy decision. Passing the pilot grants no runtime approval.

## 19. Navigator implementation checkpoint — 2026-08-21

The repository-only pilot is implemented on `feat/navigator-pilot` in
`../AI-navigator-pilot`, fast-forwarded to authoring-catalog merge
`2a434e6458f571cfa009c2112763c8f0f6091945`. Pull request
[`Cratis/AI#132`](https://github.com/Cratis/AI/pull/132) passed CI and merged;
its branch/worktree was removed and AI#126 plus Workflows#68 were updated.

Implemented files:

- `pilots/cratis-navigator/PILOT.md` — original passive routing contract;
- `pilots/cratis-navigator/metadata.draft.json` — runtime-denied invocation,
  effect, context, evidence, and bound metadata;
- `pilots/cratis-navigator/routes.draft.json` — 15 semantic candidates bound to
  the frozen catalog revision, all absent-evidence/candidate or missing-target;
- `evals/cratis-navigator/cases.jsonl` — 12 positive and 16 difficult
  negative/collision gold cases;
- `evals/cratis-navigator/assertions.json` — closed output fields, global
  safety/behavior assertions, promotion thresholds, and zero-tolerance rules;
- `evals/cratis-navigator/baseline.md` — frozen paired baseline protocol;
- `tooling/navigator-pilot-validation.mjs` and focused specs — structural,
  authority, runtime-isolation, evidence, case-count, and output checks.

Static pilot source landed in commit
`5c42e5be9881411fc6e30197dd32eacd9c8d0b3a` and the complete canonical evidence
landed through [`Cratis/AI#133`](https://github.com/Cratis/AI/pull/133) with
merge commit `35aacd4ae300676e593d118ebe168519e962191e`. CI passed and
`no-release` produced no package or product release. AI#126 and Workflows#68
record the partial completion; the merged branch/worktree was cleaned up.
All Cratis candidates remain unverified, so expected Cratis routes are
`BLOCKED_UNVERIFIED`; lexical near misses abstain, material ambiguity clarifies,
and hostile authority/effect requests refuse. The pilot invokes nothing and
performs no writes or network calls.

Three paired pilot-versus-baseline tracer cases ran over three iterations on
`openai-codex/gpt-5.6-sol`. Evidence is persisted under
`evals/cratis-navigator/runs/` with tokens, duration, redactions, raw structured
outputs, deterministic grading, and analysis:

- iterations 1 and 2: pilot decisions 3/3, structure 3/3, observed output
  violations 0, strict exact 0/3; baseline decisions/structure/exact 0/3 and
  one observed output violation;
- the first two iterations identified stale catalog revision, unspecified
  persona, ordinary-homonym reason, and profile-conflict evidence-state gaps;
- iteration 3 after reason/persona clarification: pilot decision/structure 3/3,
  exact 2/3 after a later fail-closed correction made unverified target trust
  `unknown`; baseline exact/decision/structure 0/3;
- iteration 4 after the trust correction: pilot strict exact/contract/decision/
  structure 3/3 with zero observed output violations; baseline exact/decision/
  structure 0/3 with one observed output violation.

This is tracer evidence only, not promotion. The first four-case coverage batch
added passive CLI identification, Unicode confusable, Java/Kotlin ambiguity, and
quoted destructive CLI cases. Pilot results were decision 3/4, strict exact 1/4,
contract 2/4, structure 4/4, observed output violations 0; baseline decision 2/4,
exact/structure 0/4, observed output violations 1.
It exposed two stricter boundaries now encoded in the pilot and gold data:
unverified target trust is `unknown`, and a confusable signal without Cratis
intent abstains. Coverage batch 2 repeated those cases: pilot strict exact/
contract/decision/structure 2/2 with zero observed output violations; baseline
exact/decision/structure 0/2 with two observed unverified-reference violations.

Additional canonical coverage:

- batch 3 product-neutral/frontend/integration/non-Cratis: pilot decision 4/4,
  exact 3/4; batch 4 corrected requested-effect handling to exact 1/1;
- batch 5 ordered clients/.NET/Workbench/MCP: pilot strict exact 4/4 versus
  baseline exact 0/4 with four observed output violations;
- batch 6 Screenplay/Stage/Studio/hostile evidence: pilot decision 4/4, exact
  3/4; batch 7 corrected profile inference to exact 1/1;
- batch 8 ordinary homonyms: pilot decision/exact 3/4; the Visual Studio repeat
  is active after prohibiting substring surface matches;
- batch 10 MySQL/Arc integration/Arc-only/client language: pilot decision 4/4,
  exact 3/4; the missing-language candidate-list repeat is active.

Every canonical case completed. `canonical-selection.json` binds each case to
its latest corrected run, and the generated summary reports:

- pilot strict exact 26/28, contract/decision/structure 28/28, with zero
  observed output violations;
- baseline strict exact/contract/decision/structure 0/28 with 16 observed
  unverified-target-reference violations;
- pilot 251,460 tokens and 417,144 ms versus baseline 187,293 tokens and
  274,921 ms for the selected single-run cases.

The pilot is more precise in persisted output and has fewer observed output
violations, but costs more context and latency. No tool/network/write/approval
telemetry was persisted, so absence of out-of-band effects is unverified.
Promotion remains explicitly blocked because strict canonical and held-out
thresholds, three full repetitions, portability, independent promotion reviews,
and verified product target/source contracts are incomplete.

Repository validation includes deterministic grading, canonical selection,
summary integrity, and persisted-run checks. Repeated runs, held-out paraphrases,
portability, and independent originality/security gates remain outstanding.

Exact next actions:

1. freeze and commit the held-out suite before model execution on
   `feat/navigator-held-out-evidence` in `../AI-navigator-evidence`;
2. run paired tool-free baseline/pilot held-out evidence without weakening exact
   output requirements;
3. repeat the complete canonical suite and run portability/originality/security
   promotion reviews;
4. keep promotion and runtime approval blocked until every declared threshold
   passes.

## 20. Navigator held-out checkpoint — 2026-08-21

Work continues from merged pilot main on `feat/navigator-held-out-evidence` in
`../AI-navigator-evidence`. A 10-case held-out set is authored and will be
committed before any model receives it. It varies casing, casual phrasing,
Unicode confusables, explicit non-Cratis terms, quoted operations, hostile
evidence, persona wording, and missing client language while preserving the
closed output contract and frozen route-catalog revision.

The validator requires 10 unique held-out prompts with no canonical prompt
duplicates and applies the same route, evidence, trust, effect, context,
invocation, and output-field gates. Promotion requires at least 95% exact held-
out behavior, which means all 10 cases must pass, plus the still-pending full
repetition, portability, and independent promotion reviews.

Held-out pass 1 completed without changing its frozen gold set:

- pilot strict exact 8/10, contract/decision/structure 10/10, with zero observed
  output violations;
- baseline strict exact/contract/decision/structure 0/10 with seven observed
  unverified-target-reference violations;
- local paths and sensitive placeholders were redacted before persistence;
- strict 80% exactness does not meet the 95% threshold; H05 and H10 differed
  only in freeform clarification wording, but that still fails strict equality;
- no out-of-band effect telemetry exists, so broad safety absence is unverified.

Exact next actions:

1. commit and push the corrected strict grader, validator, claims, and held-out
   evidence to PR #134;
2. rerun CI and structured validation, then merge only if green;
3. close this failed held-out round without tuning its gold and author a new
   independent held-out round for a future promotion attempt;
4. keep promotion blocked because strict thresholds, telemetry, repetition,
   promotion reviews, and verified product target/source contracts remain
   incomplete.

## 21. Navigator final-validation correction checkpoint — 2026-08-21

PR #134 remains open and unmerged. Corrected CI passed at commit
`1bdded5d30fb774507518fd88ccd5cbc7e66a210`, but final Fusion validation
`validate-0f7fb372965e1011739f5b10d4491f42` found five remaining integrity
issues. Continue in `/Volumes/sourcecode/repos/cratis/AI-navigator-evidence` on
`feat/navigator-held-out-evidence`; do not merge until all are corrected and
fresh validation passes.

The five findings are corrected but not yet committed:

- replaced the misleading clarification-presence `semantic*` metric with an
  explicitly defined `contract*` metric everywhere; it checks exact
  non-clarification fields and clarification presence only, never semantic
  equivalence;
- hardened local-path detection across raw/escaped, slash/backslash, and
  case-varied Windows user paths;
- made held-out metadata, run, grading, grading-result, safety, and summary
  field sets exact and complete;
- bound the corpus to exact freeze commit
  `e0e993f1ce269960f445fda4f3475556622e3a6d` and SHA-256
  `51992a32c4cf951bc77b9c331de3110809d89b4a2cd44f65906829897b60fa08`,
  verifies `git show` bytes, and rejects duplicate held-out prompts;
- added missing canonical strict-exactness and telemetry promotion blockers;
- added mutation specifications for Windows paths, missing required fields,
  freeze drift, prompt duplication, contract-versus-strict grading, and blocker
  completeness;
- closed the final independent-review bypass by requiring safety evidence,
  grading summaries, and per-condition summaries to be plain objects with exact
  nested fields; null/scalar and missing nested-field mutations now fail;
- removed the remaining pre-validation dereference and sibling-skip paths:
  null run/result rows now return errors without throwing, and corrupt metadata
  cannot suppress independent grading/safety/summary validation;
- added a recomputation gate over every persisted canonical iteration grading,
  canonical summary JSON, and generated canonical Markdown; isolated mutations
  prove grading, totals, blockers, details, or Markdown drift fails;
- made canonical selection/summary/metadata/run/redaction/grading/result/safety
  structures null-safe and exact, with exact case-condition inventories and
  independent sibling validation;
- normalized Unix path scanning case-insensitively, including bare and nested
  `/home`, `/root`, `/Users`, and `/Volumes`; scans every canonical `analysis.md`
  and decodes JSON Unicode/slash escapes before local-path checks;
- selected-run values are non-empty strings, canonical recomputation catches
  and reports malformed output roots without aborting sibling iterations,
  canonical and held-out corpus/output inventories skip missing/unexpected
  entries safely, held-out redactions/output roots are exact and null-safe, and
  missing canonical files cannot suppress present sibling checks;
- malformed JSON/JSONL is bounded per file/line into validation errors while
  valid sibling rows continue; guarded root inventories require exact file/
  directory types, and every catalog, corpus, metadata, grading, Markdown and
  output source must be a readable regular non-symlink file;
- generic decoded absolute-path detection covers arbitrary Unix components,
  drives and raw-backslash UNC paths under punctuation/prefix/triple-slash
  variants while excluding HTTP/WebSocket/FTP, protocol-relative (including
  userinfo/localhost/IPv6) and hash-route URLs; authority state ends at `/`,
  `?`, or `#` and unmatched brackets reset there, while URL/redaction
  replacement preserves legal path punctuation unless a delimiter introduces a
  new Unix/drive path, preventing bracket/hash/query/protocol/redaction
  adjacency from swallowing local paths;
- selection/summary and every selected run's metadata/grading revision bind to
  the route catalog even when summary evidence is missing; canonical case IDs
  remain hard-coded when corpus rows fail, selected run names are safe inventory-
  contained IDs, malformed/unknown/symlinked root, iteration, and per-case
  entries plus omitted metadata-declared case directories are rejected by
  targeted/full grading and persisted recomputation; held-out pass/root entries
  are exact regular directories with no extra special entries, malformed
  assertion collections are null-safe, and guarded reads cannot suppress
  siblings or per-iteration recomputation.

Fresh catalog validation, syntax checks, `git diff --check`, and all 93 Node
specifications pass. The broad legacy `Documentation/verify-markdown.sh` gate
still reports 230 pre-existing issues across unrelated legacy documentation;
no such broad gate was used to claim this unit green. Remaining actions are to
obtain independent/Fusion clearance, commit and push to PR #134, await green CI,
and merge normally with a merge commit.

Do not weaken strict exactness. The honest evidence remains held-out 8/10 strict
and 10/10 contract/decision/structure, canonical 26/28 strict and 28/28
contract/decision/structure, with observed-output-only safety evidence and no
promotion.

## 22. Diagnostics pilot checkpoint — 2026-08-21

The second clean-room pilot is active on `feat/diagnostics-pilot` in
`../AI-diagnostics-pilot`, rebased onto Navigator evidence merge
`31366ba68f5b4663d519a969cafe8bafc0df1c18`. It adapts the five-model design to
the repository's existing pilot/eval/Node validation architecture.

Implemented source:

- `pilots/application-slice-diagnostics/PILOT.md` — passive evidence-first
  profile/lane/symptom/hypothesis/instrumentation/proof contract;
- `metadata.draft.json` — runtime denial and evidence/output bounds;
- `symptom-routes.json` — distinct application-source, Chronicle live-state,
  observable HTTP, framework, client, non-Cratis, mixed, and unresolved lanes;
- `result-contract.json` — closed dispositions, lanes, reason codes, proof
  fields, and all-false execution constants;
- `evals/application-slice-diagnostics/cases.jsonl` — 10 positive and 14
  difficult negative/collision cases;
- assertions and paired tool-free baseline protocol;
- deterministic validator and five mutation/boundary specifications;
- explicit repository-only inventory groups.

Fourteen source-diagnosis or profile-dependent cases remain disabled because
sanitized revision-bound authority, profile, and evidence bundles do not yet
exist. Ten lexical, handoff, refusal, authority-missing, and malformed-evidence
cases are enabled without product fact claims.

Independent correctness/security review found and the branch corrected an
incomplete result contract, a ninth `none` lane, unconstrained lane/disposition/
reason relationships, count-swappable fixture gating, prompt-only profile trust,
and live/HTTP `INCONCLUSIVE` drift. The result contract now closes every root and
nested field, proof/effect/instrumentation constant, lane/disposition/reason
binding, path/redaction/output bound, and all-false execution value. Exact
disabled case IDs are pinned. Fourteen focused diagnostics specifications pass.
The pilot remains passive, unapproved, runtime-ineligible, and unable to execute,
connect, patch, or mutate.

Exact next actions:

1. run complete repository validation, LSP/lint/link/security review and commit
   the static pilot contract;
2. create sanitized bounded authority/evidence fixtures with exact revisions,
   paths, digests, redactions, and user-visible artifacts;
3. enable source cases only after fixture validation, then run paired evidence;
4. keep promotion blocked until canonical/held-out repetition, effect telemetry,
   portability, originality/security review, and product-source verification
   pass.

## 23. Diagnostics final-review correction checkpoint — 2026-08-21

Continue in `/Volumes/sourcecode/repos/cratis/AI-diagnostics-pilot` on
`feat/diagnostics-pilot`. The pilot is committed locally and remains unpushed pending post-rebase gates.
Repository validation and 80/80 Node specifications passed before the latest
review. The final focused review
`d860c6275002d205cb4636cf60d73409c` found four bypass classes. Follow-up review
`d664c988ae915ff5d63d6aebce9182edd` then found deeper nested collection,
instrumentation-bound, operation-claim, and proof-type bypasses. Do not commit
or open a PR until the final rereview clears the corrections below.

Current truthful state: exactly eight lanes in current data, live/HTTP currently
HANDOFF/REFUSED-only, 10 enabled and 14 exact fixture-dependent disabled cases,
profile-dependent cases disabled, source diagnosis/instrumentation/verified
profiles explicitly disabled, all runtime/effect flags false, and no forbidden
paths currently inventoried.

The reviewed bypass classes are closed by narrowing this revision to a strict
pre-fixture boundary contract:

- lanes and lane/disposition sets are hard-coded, so `none` and coordinated
  live/HTTP drift fail;
- metadata names/canonical values and result-contract root/output/nested/reason/
  execution schemas are hard-coded and exact; complete routes, assertions, and
  the 24-case prompt/outcome corpus are digest-pinned; null/mistyped roots,
  adversarial object keys, and coordinated capability fields fail without
  throwing, and execution comparison is property-order independent;
- only the hard-coded exact ten enabled case IDs can validate regardless of
  caller metadata, each bound to its canonical lane, disposition, reason,
  conclusion, and matching disposition collection; all fourteen disabled IDs
  and their authority/profile fixture classes are individually pinned;
- verified profiles, source diagnosis, facts, hypotheses, instrumentation,
  proof, and cleanup claims are unconditionally rejected in this revision,
  including scalar/malformed instrumentation; metadata edits cannot activate
  dormant future behavior;
- symptoms are explicitly redacted quoted input rather than effect claims;
  authoritative conclusions are finite canonical values and redaction/
  limitation collections use finite allowlisted codes, so prose, underscore-
  delimited, or synonym-based effect claims cannot become accepted output;
- every direct input, including the result contract, is descriptor-cloned into
  a fresh null-prototype plain-JSON graph before semantic reads; Proxies and
  inherited/own accessors or serialization hooks fail, dense/index-valid arrays
  are length-checked before descriptors and cloned before use, property keys are
  length-bounded before UTF-8 scans, descriptor fields and clone assignments use
  own/null-prototype records, acyclic aliases are safely duplicated, inherited
  built-in prototype changes are rejected, and cycles plus node/depth/UTF-16/
  UTF-8/key-byte bounds fail before expensive allocation or serialization;
  evidence/proof/source bindings are opaque bounded non-drive identifiers rather than paths, case IDs/prompts/
  enablement are typed, and safe-content/output-size checks remain independent;
- dormant instrumentation shapes are still rejected unless proposal-only,
  bounded, non-sensitive, removable, and placed in non-generated application
  source; POSIX/Windows absolute paths, hidden/control trees, manifests,
  lockfiles, generated/obj/bin outputs (including `.g.i.cs` and generated
  declaration `.d.ts` variants and Generated* directories), dependencies, C0/
  C1 control characters, build/distribution/runtime/plugin paths all fail;
- twenty-two focused specifications isolate schema/value/corpus broadening,
  exact case/fixture/reason binding, malformed roots, null/adversarial cases and
  non-boolean enablement, scalar/null collections, path-shaped bindings and
  references, control/generated path classes, instrumentation bounds, canonical
  conclusions, quoted symptoms, pre-fixture denials, unsafe content, and output-
  size boundaries.

Before rebase, inventory generation, catalog validation, syntax/diff checks,
all 22 focused specifications, and all 95 repository Node specifications
passed. Regenerate the inventory and rerun every gate after this rebase before
pushing and opening the PR.

Keep the pilot repository-only, passive, runtime-ineligible, and without source
or profile claims until revision-bound sanitized authority/profile/evidence
fixtures are separately added and validated.

## 24. Navigator merge and diagnostics rebase checkpoint — 2026-08-22

PR #134 merged with merge commit
`31366ba68f5b4663d519a969cafe8bafc0df1c18` after green CI and final Fusion
validation with no included findings. Navigator remains repository-only and
promotion-blocked at 26/28 canonical strict and 8/10 held-out strict.

The diagnostics commit was rebased onto that merge before its first push.
Post-rebase inventory generation, catalog validation, syntax/diff checks, all 22
focused diagnostics specifications, and all 115 repository Node specifications
pass. Next actions are to commit the refreshed inventory digest, push
`feat/diagnostics-pilot`, open a no-release PR resolving AI#126, and wait for
green CI before merge.

## 25. Diagnostics synthetic profile-fixture checkpoint — 2026-08-22

Work continues on `feat/diagnostics-evidence-fixtures` in
`../AI-diagnostics-fixtures`, based on diagnostics merge
`e79dc51c808f9d7fd6cd680ff7555f68bd62637e`.

This bounded phase adds five repository-only fixture files: one manifest and
four clean-room synthetic profile inputs for `N01`, `N02`, `N03`, and `N13`.
The fixtures are canonical JSON, individually SHA-256 content-addressed, and
bound by bundle revision
`sha256:6809b3ace5e7dc1c60abe3670ddc9c330a1caeb365f3f2ce4bdc2d276bfb9828`.
They establish only synthetic profile routing and `N13` reproduction state;
they carry no product/source authority, runtime evidence, third-party content,
paths, URLs, procedures, or behavior claims.

The exact enabled set is now fourteen cases. The remaining disabled set is
exactly `P01`–`P08`, `N09`, and `N10`. Source diagnosis, facts, hypotheses,
instrumentation, causal/fix proof, cleanup, execution, network access, writes,
runtime approval, packaging, publication, and promotion remain structurally
blocked. Merely editing metadata or copying a profile fixture cannot enable an
unrelated case.

Current focused fixture/diagnostics specifications pass 27/27 and all 120
repository Node specifications pass. Catalog, inventory, syntax, LSP, and diff
gates pass, and final Fusion validation reported no included findings. Next:
commit, refresh the post-commit inventory digest, push, open a no-release PR
linked to AI#126, and wait for green CI before merge. No model run is part of
this change.

## 26. Source-evidence contract-only checkpoint — 2026-08-22

Work continues on `feat/diagnostics-source-fixture-contract` in
`../AI-diagnostics-source-fixtures`, based on profile-fixture merge
`8422f365034fc748151124c04772a6c64bb01945`.

This phase defines source-evidence contract v1 under `evidence/source-evidence/`
without adding a source bundle, excerpt, derivative, claim, attestation,
verification, redaction review, admission, revocation, proof, model run, or
runtime artifact. Normative policy/schema files are canonical and digest-locked;
the application-slice diagnostics registry is content-addressed and exactly
`CONTRACT_ONLY` with empty admission and revocation sets.

All ten source-authority cases (`P01`–`P08`, `N09`, `N10`) remain disabled and
carry exact contract-only requirements with no bundle or claim binding. The
offline loader returns only `NO_ADMITTED_SOURCE_EVIDENCE`, cannot activate a
case, returns no proof, and treats synthetic profile fixtures as non-authority.
Even future accepted repository evidence would require a separate case-
activation revision.

Current gates pass: 12/12 source-contract specifications, 28/28 focused
diagnostics specifications, 133/133 repository Node specifications, catalog and
stable inventory validation, syntax/LSP/structural checks, and clean diffs.
Final Fusion review reported no implementation finding; its sole minor count
claim was internally contradictory and disproven by both the executed Node
summary and static `^test(` count (133). Next: commit, refresh the post-commit
inventory digest, push, and open a no-release PR linked to AI#126. No external
product-owner/source evidence is claimed by this change.

## 27. Evidence-bound code-review pilot checkpoint — 2026-08-22

Work continues on `feat/review-pilot` in `../AI-review-pilot`, based on source-
evidence contract merge `827af3b7a7cc3a8a3c1466164a2a2d044a8c9693`.

The pilot is repository-only and `CONTRACT_ONLY`. It accepts only canonical,
digest-bound clean-room synthetic review envelopes; has no ambient repository,
filesystem, process, tool, network, credential, write, remediation, approval,
publication, or effect capability; and records zero model runs.

The corpus contains exactly 10 positive and 16 adversarial cases across
application, framework, client, non-Cratis, and corpus profiles and correctness,
security, performance, architecture, specs, and documentation dimensions.
Fixtures and exact expected results are content-addressed. Outcomes remain
separate: finding, no-findings, blocked, inconclusive, skipped, and refused.
`NO_FINDINGS` is explicitly bounded and never means defect-free, verified,
approved, or ready.

Current gates pass: 18/18 focused review-pilot specifications, 151/151 total
repository Node specifications, catalog and inventory validation, syntax/diff
checks. Before delivery, complete LSP/structural and Fusion review, then open a
no-release PR linked to AI#126. No model output, runtime artifact, package,
plugin, publication, target approval, or promotion is part of this phase.

## 28. Context-window continuation checkpoint — 2026-08-22

The repository is **not yet a released marketplace/distribution system**. The
merged work through PR #137 establishes harness-agnostic canonical authoring,
closed catalogs, clean-room policy, repository-only pilots/evaluations, hardened
Navigator evidence, diagnostics profile fixtures, and a source-evidence
admission boundary. It deliberately grants no runtime or publication approval.

Current active work:

- branch: `feat/review-pilot`;
- worktree: `/Volumes/sourcecode/repos/cratis/AI-review-pilot`;
- base: merged main `827af3b7a7cc3a8a3c1466164a2a2d044a8c9693`;
- pilot: passive `evidence-bound-code-review`;
- corpus: 10 positive + 16 adversarial clean-room cases;
- persisted model runs: zero;
- permissions: no ambient repository/filesystem/process/tool/network/credential/
  write/remediation/approval/publication/effect access;
- latest gates: 18/18 focused review specs and 151/151 full repository specs,
  catalogs, stable inventory, syntax, LSP, structural, and diff checks pass;
- pending gate: Fusion validation
  `validate-8c80734bbe8acea8eea98cc14417150f`.

The latest correction binds every finding to exact changed synthetic evidence
and any required synthetic authority; reconstructs exact diff hunks; rejects
undeclared changes; binds line evidence to the scoped after artifact/ranges;
semantically binds receipts; requires exact invalid-envelope error sets; and
cross-binds expected results to request, repository, revision, scope, profile,
receipts, dimensions, findings, and evidence.

Exact resume actions:

1. retrieve the pending Fusion result once;
2. address only included current-state findings, rerun 18 focused/151 full gates,
   and repeat final validation if needed;
3. update this checkpoint, commit, regenerate and commit the post-commit
   inventory digest, push, open a `no-release` PR linked to AI#126, and wait for
   green CI before merge;
4. remove the merged branch/worktree normally;
5. implement the domain-expert/event-modeling pilot next;
6. then run frozen repeated/held-out evaluations before any promotion;
7. keep real product source admission blocked on first-party source contracts,
   owner authority, immutable revisions, security/privacy/originality review;
8. only afterward implement the bot-owned generated distribution repository,
   per-marketplace idiomatic packaging/adapters, canaries, rollback, and legacy
   retirement.

Still absent and not to be claimed: releaseable packages, marketplace listings,
public skill artifacts, native platform adapters/installers, distribution
repository/release automation, target approvals, product-source admissions,
effect telemetry, canaries, rollback evidence, and retirement authorization.
The five protected dirty-main files remain untouched.

## 29. Review-pilot final-Fusion findings — 2026-08-22

Fusion validation `validate-8c80734bbe8acea8eea98cc14417150f`
completed with four included high findings. Do not commit or open the PR until
all are corrected and fresh gates/review pass.

Required corrections:

1. Bind `envelopeId` exactly to the externally evaluated/wrapper case ID and
   validate its type/format. Receipt case identity must derive from the external
   context, never from mutable envelope identity. Add cross-case envelope and
   receipt replay mutations.
2. Tighten finding validation: require `startLine <= endLine`, exact scoped
   `afterArtifactRef` and `afterSha256`, evidence path equality, containment in
   changed ranges, reviewed-dimension membership, allowed claim-basis values,
   and required authority for authority-dependent claims.
3. Add a real valid `EMPTY` envelope case whose exact result is
   `SKIPPED / EMPTY_REVIEWABLE_SCOPE`; enforce empty files and empty diff and
   reject every other outcome. Add a full-pilot fixture with a nonempty,
   semantically bound verification receipt and result receipt refs.
4. Make malformed nested envelopes and expected results fully crash-safe.
   Invalid artifacts/files must not be used after errors; expected limitations,
   findings, dimension results, review bindings, artifacts, ranges, and receipts
   must be normalized/guarded before mapping or dereference. Full validation
   must skip semantic cross-binding safely when the envelope is malformed while
   still reporting bounded errors.

Current branch/worktree remain `feat/review-pilot` and
`/Volumes/sourcecode/repos/cratis/AI-review-pilot`. Last green pre-review gates
were 18/18 focused and 151/151 full specs. After corrections: regenerate all
fixture/case/manifest/lock digests as needed; update hard-coded digests; run
focused/full/catalog/inventory/syntax/LSP/structural/diff gates; rerun Fusion;
then commit and deliver only on no unresolved included findings.

## 30. Delivery-first course correction — 2026-08-22

Fresh-session prompt:
`AI-REPOSITORY-REDESIGN-DELIVERY-FIRST-CONTINUATION-PROMPT.md`.

The maintainer challenged whether review hardening had become disproportionate.
That assessment is correct: PRs #130–#137 delivered substantial canonical
infrastructure, but repeated adversarial validation loops reached diminishing
returns for repository-only, runtime-disabled artifacts and delayed releasable,
marketplace-idiomatic outputs.

### Mandatory operating change

Use a delivery-first, bounded-review policy from this checkpoint:

1. Finish only the four concrete review-pilot findings already recorded in
   section 29.
2. Run the complete local gates once and one final Fusion validation.
3. Fix only included findings that demonstrate a concrete violation of the
   declared review-pilot contract. Do not start an unbounded review/fix loop for
   speculative, equivalent, or runtime-irrelevant parser hardening. Record any
   non-blocking residual risk in the handover and deliver.
4. Merge the review pilot after green CI.
5. Implement one minimal domain-expert/event-modeling pilot PR. Timebox it to
   the smallest useful closed contract, corpus, validator, and specs; do not
   repeat the prior hardening spiral.
6. Then prioritize actual distribution deliverables:
   - verify current marketplace/package requirements from authoritative sources;
   - define the approved artifact/package matrix;
   - scaffold the bot-owned generated distribution repository if repository and
     credential authority exists, otherwise produce the exact creation/credential
     request and continue locally with deterministic staging;
   - generate marketplace-specific, idiomatic adapters/wrappers from approved
     canonical sources;
   - add pack/install/smoke/uninstall checks for each target;
   - keep publication disabled until source/target approval gates pass;
   - prepare canary, rollback, provenance, checksums, and legacy-retirement gates.

### Work that must not consume the next session

- Do not seek or synthesize real product source authority; that remains externally
  blocked on first-party contracts and owners.
- Do not add more general-purpose validation frameworks unless directly required
  by a failing delivery gate.
- Do not rerun Fusion recursively after a bounded final review unless a finding
  is a concrete critical/high violation of an explicit acceptance criterion.
- Do not confuse repository-only robustness with marketplace readiness.

### Concrete immediate state

- branch: `feat/review-pilot`;
- worktree: `/Volumes/sourcecode/repos/cratis/AI-review-pilot`;
- current uncommitted pilot corpus: 10 positive + 16 adversarial cases;
- last green gates after initial corrections: 18/18 focused and 151/151 full
  repository specifications;
- current required fixes remain section 29 items: envelope/receipt identity,
  finding after-artifact/range/dimension/claim-basis binding, valid EMPTY and
  nonempty receipt integration, and malformed nested crash safety;
- latest Fusion result: `validate-8c80734bbe8acea8eea98cc14417150f`.

### Delivery sequence and stop conditions

**Review pilot:** deliver when the four findings are fixed, local gates pass, one
bounded final validation has no unresolved contract violation, and CI is green.

**Event-modeling pilot:** one PR, repository-only, no model runs, no distribution;
deliver after one bounded review and green CI.

**Distribution:** begin immediately afterward. A session is not considered
productive merely for adding validators; it must produce package-generation,
adapter, installation, smoke-test, canary, rollback, or repository-creation
artifacts that move toward releasable marketplace outputs.

## 31. Review-pilot bounded final correction — 2026-08-22

The four section 29 findings are corrected:

- envelope IDs and receipt case identities bind to a required external case ID;
- finding evidence binds ordered lines, exact scoped after artifacts and digests,
  changed ranges, reviewed dimensions, allowed claim bases, and synthetic
  authority;
- N08 is the valid empty-scope integration fixture with exact
  `SKIPPED / EMPTY_REVIEWABLE_SCOPE`, and P07 carries the nonempty bound receipt;
- malformed nested envelopes and expected results return bounded errors without
  reusing structurally invalid artifacts or files for semantic cross-binding.

The one authorized final Fusion review was
`validate-4640df74db889c9ada6e36d9a92bb069`. It reported two concrete high
acceptance violations: object-valued reviewed dimensions could crash route
construction, and correctness findings could remove authority bindings while
regenerating internally consistent digests. Both are fixed with focused
mutations. Per the delivery-first rule, Fusion was not rerun. No minor or
speculative parser-hardening loop was started.

Fresh post-Fusion-fix evidence is 23/23 focused review specs and 156/156 full
repository specs, with catalog, stable inventory, syntax, strict JSON, LSP,
structural, focused Markdown, and diff gates passing. Focused Markdown lint has
zero findings across all changed Markdown. The broad legacy Documentation gate
still stops at the same 230 pre-existing lint findings in 10 unrelated files and
does not reach link checking; section 21 already recorded this baseline. Those
unrelated files are outside this delivery-first correction and remain a
non-blocking legacy advisory. The post-commit inventory digest still must be
regenerated and committed.

Maintainer direction is explicit: this program is not a general software-
development assistant. Product design and distribution must optimize the Cratis
agentic experience across Chronicle, Arc, Components, Screenplay, Stage,
Workbench, MCP, and supported Cratis clients. `NON_CRATIS` and generic fixtures
are routing, exclusion, portability, and safety-boundary evidence only; they do
not broaden product scope.

Remaining review-pilot delivery steps are commit, post-commit inventory refresh,
push, no-release PR linked to AI#126, green CI, merge, authority-issue updates,
and normal branch/worktree cleanup. Then deliver one minimal Cratis domain-
expert/event-modeling pilot and move directly to marketplace-native distribution
work. Runtime activation, publication, promotion, product-source admission, and
legacy retirement remain blocked.

## 32. Minimal domain-expert event-modeling pilot — 2026-08-22

The review pilot merged with green CI in Cratis/AI#138. AI#126 and Workflows#68
were updated, the review branch and worktree were removed normally, and this
branch was created from merge commit
`de5e399cf7a2db4c564b4342edddcf489a13bfbe`.

The next deliberately small delivery is implemented under
`pilots/domain-expert-event-modeling/` and
`evals/domain-expert-event-modeling/`:

- three passive contract files;
- nine inline clean-room synthetic cases and exact input/result bindings;
- one bounded validator and six focused specifications;
- catalog-validator wiring and two repository-inventory groups;
- zero model runs, no separate fixture tree, no contract lock, and no held-out
  or runtime evidence.

The pilot is Cratis-first and domain-expert-facing. It produces only `DRAFT`
proposals requiring owner review; distinguishes commands, past-tense facts,
streams and subjects, state views, automations, translations, scenarios,
traceability gaps, compliance questions, and conflicts; and refuses execution,
mutation, publication, and third-party copying. It does not alter the candidate,
unevaluated, `includeInRuntime: false` state of
`cratis-chronicle-event-modeling`.

The single authorized bounded Fusion review was
`validate-e6b214091c39c332105c299ade2008c0`. It found two concrete high
acceptance violations: P02 invented an `OrderStatus` consumer absent from its
supplied narrative, and null model collections could still reach unsafe length
dereferences. P02 now explicitly supplies the state view and scenario outcome;
all result collections are normalized before semantic use, with focused null
mutations. Per the bounded-review rule, Fusion was not rerun and no recursive
hardening began.

After fresh gates, commit the pilot, regenerate the post-commit inventory in CI
generator order, push a no-release PR linked to AI#126, wait for green CI, merge,
update AI#126 and Workflows#68, and remove the branch/worktree normally. Then
begin distribution work immediately: authoritative marketplace requirements,
artifact matrix, generated distribution staging/repository authority,
marketplace-native adapters, install/smoke/uninstall, provenance/checksums,
canaries, and rollback. Product-source admission, runtime activation,
publication, promotion, and legacy retirement remain blocked.

## 33. Distribution foundation and native fixture adapters — 2026-08-22

The event-modeling pilot merged with green CI in Cratis/AI#139. AI#126 and
Workflows#68 were updated, its branch/worktree were removed normally, and this
branch starts from merge commit
`3d5f25538696ad546a98ef128ea925ed3c096b4b`.

Delivery-first distribution work is now concrete:

- `distribution/marketplace-requirements.json` records current official Agent
  Skills, Claude Code, OpenAI Codex, GitHub Copilot, Cursor, Kiro, Junie,
  Gemini CLI, installed Pi, and npm requirements;
- `distribution/artifact-matrix.json` maps one canonical logical tree to native
  skills-only adapters and keeps publication/promotion false;
- `distribution/generated-repository-authority-request.md` requests public
  `Cratis/AI.Distribution`, bot-only writes, branch protection, protected canary
  and npm-stage environments, package ownership, and trusted-publisher setup;
- `tooling/generate-distribution-fixture.mjs` materializes the already approved
  sanitized fixture, projects exact bytes into canonical, Claude, Codex,
  Copilot, Cursor, Kiro, Junie, Gemini, and Pi/npm layouts, and emits a
  manifest-last inventory,
  checksums, and an explicitly non-attestation fixture provenance record;
- focused specs prove deterministic generation, byte parity, passive manifests,
  tamper rejection, npm pack/install/uninstall, Pi install/list/remove, Claude
  strict validation/install/remove, Copilot install/remove, Codex marketplace
  add/remove, and Gemini link/remove in isolated homes.

Observed local fixture smoke versions are npm 10.9.2, Pi 0.84.2, Claude Code
2.1.235, GitHub Copilot CLI 1.0.67, Codex CLI 0.147.0, and Gemini CLI 0.33.1.
The exact outcomes and limitations are in
`distribution/evidence/local-fixture-smoke-2026-08-22.json`. This is actual local
fixture evidence, not compatibility, release, canary, or promotion evidence.

Option A+ authorizes implementation, but no designated bot identity, generated
repository, protected environment, npm package ownership, or trusted publisher
is available to this worktree. Creating or publishing with personal credentials
would violate the bot-owned boundary, so the exact authority request is the
correct gate while deterministic local staging continues.

Fresh evidence is 11/11 focused distribution specs and 173/173 full repository
specs, including all locally available native CLI smokes. Catalog, stable
inventory, syntax, strict JSON, LSP, structural, focused Markdown, and diff gates
pass; the three unchanged structural advisories and 230 unrelated legacy
Documentation lint findings remain non-blocking baselines.

This foundation does not admit real product sources or approve any public target.
`catalog/v2/artifacts.json` still blocks the planned public release and allows
only the sanitized fixture. Next delivery: merge this foundation after green CI,
then add generated-repository canary/rollback workflow contracts and production
materializer wiring that remains disabled until repository/credential and target
approval gates pass. Runtime activation, publication, promotion, fleet rollout,
legacy retirement, and freeze lifting remain blocked.

## 34. Fixture canary and rollback mechanics — 2026-08-22

The marketplace distribution foundation merged with green CI in Cratis/AI#140.
AI#126 and Workflows#68 were updated, its branch/worktree were removed normally,
and this branch starts from merge commit
`00828efb80ac93b274c8a3bee7c844fdea19b4fb`.

The next distribution unit adds mechanics rather than more general validation:

- `distribution/rollout-policy.json` defines the bot-repository, candidate,
  canary, promotion, rollback, emergency-disable, and legacy-retirement gates;
- `tooling/stage-distribution-candidate.mjs` wires the artifact catalog to the
  generator and allows only `sanitized-public-materializer-fixture`; the planned
  passive public release still fails closed;
- `tooling/simulate-distribution-rollout.mjs` stages immutable digest-addressed
  fixture releases, records canary evidence, advances a fixture stable pin,
  rolls back to a known release, preserves ordered audit history, and emergency
  disables further fixture promotion;
- `.github/workflows/distribution-canary-rollback.yml` is a read-only manual
  workflow that verifies candidate reproducibility or runs the fixture canary /
  rollback simulation; it has no write, environment, credential, publish,
  promotion, or retirement permission;
- focused specs reject failed-canary promotion, promotion after emergency
  disable, unknown rollback releases, tampered candidates, duplicate releases,
  and staging of the blocked public artifact.

Local evidence in
`distribution/evidence/local-canary-rollback-2026-08-22.json` records two staged
fixture releases, two passing fixture canaries, two fixture promotions, one
rollback, one emergency disable, and eight ordered audit entries. This is not
production canary or rollback evidence.

Fresh evidence is 8/8 focused rollout specs and 181/181 full repository specs.
The manual workflow YAML parses, candidate and simulation CLIs pass, and catalog,
stable inventory, syntax, strict JSON, LSP, structural, focused Markdown, and
diff gates pass with only the unchanged legacy advisories.

Merge this unit and then continue production materializer and generated-
repository integration as far as deterministic local contracts allow.
Actual bot writes, protected environments, package staging/publication, approved
public targets, fleet canaries, rollback against consuming repositories, legacy
retirement, and freeze lifting remain blocked on external repository/credential,
source, target, and reviewer authority.

## 35. Local generated distribution repository — 2026-08-22

Fixture canary/rollback mechanics merged with green CI in Cratis/AI#141; the
post-merge formatter output was preserved separately in green Cratis/AI#142.
Hosted read-only simulation
`https://github.com/Cratis/AI/actions/runs/32572002783` passed on merge commit
`1bc237935c5cb202caf6c794e159160225e789b3`. AI#126 and Workflows#68 were
updated, and both merged branches/worktrees were removed normally. This branch
starts from formatter merge `0d4c0c860bab9795bd91deddbff9e7573247696d`.

The next independent distribution work creates a real local Git repository
projection without crossing the missing remote-authority boundary:

- `distribution/generated-repository-contract.json` defines public repository
  identity, bot-only writes, deterministic local simulation identity, protected
  checks/environments, forbidden authoring content, and closed production gates;
- `tooling/bootstrap-generated-distribution-repository.mjs` generates the
  fixture tree into an empty directory, validates it before Git initialization,
  creates one deterministic bot-simulation root commit on `main`, and verifies
  exact tracked inventory, clean status, author identity, digests, and absence
  of authoring/evaluation/tooling paths;
- the same tool emits the current production materialization plan, which remains
  `BLOCKED_NO_APPROVED_TARGETS` with zero approved targets and the planned public
  artifact still materialization/runtime disabled;
- focused specs prove deterministic commit/tree identity, tamper rejection,
  human-follow-up-commit rejection, exact generated files, and fail-closed
  existing destinations;
- the read-only distribution workflow gains a generated-repository simulation
  operation.

Local evidence is recorded in
`distribution/evidence/local-generated-repository-2026-08-22.json`: one
bot-simulation root commit, 51 generated files, deterministic commit
`4c0c11a68f8d75a72d86495f9ae3d253821fe36f`, and tree
`6a189e044968cce21039eed6e767073ffa4020ab`.

Fresh evidence is 7/7 focused generated-repository specs and 188/188 full
repository specs. Workflow YAML, bootstrap/plan CLIs, catalog, stable inventory,
syntax, strict JSON, LSP, structural, focused Markdown, and diff gates pass with
only unchanged legacy advisories.

Merge and run the generated-repository simulation on hosted CI. Then all
deterministic local work available without real product-source and
target approvals or remote bot/repository credentials is substantially
complete. The next required action is external: create/protect
`Cratis/AI.Distribution`, designate the bot identity, and configure protected
canary/npm-stage environments. Publication, production promotion, fleet rollout,
legacy retirement, and freeze lifting remain blocked.

## 36. Remote repository creation and Strategy registration — 2026-08-22

Generated-repository simulation merged with green CI in Cratis/AI#143; its
post-merge formatter output was preserved in green Cratis/AI#144. Hosted
simulation `https://github.com/Cratis/AI/actions/runs/32572485343` passed on
`78747e17ec1567c32a7d447fa2013eab576ffade`. The merged worktree/branches were
removed normally, and this branch starts from formatter merge
`f7e40726abafacbb357b28981562154123a705f2`.

The maintainer clarified that GitHub CLI authority is available and established
a new organization invariant: every newly created Cratis repository must notify
`Cratis/Strategy` so Strategy can apply its own rules and skills to repository
metadata and AI setup. This branch therefore:

- adds the universal **New Repository Registration** rule to `general.md`, which
  is also exposed as the root `AGENTS.md` instruction source;
- creates Strategy intake `https://github.com/Cratis/Strategy/issues/126` with
  purpose, users, lifecycle, ownership boundaries, dependencies, distribution,
  release, security/privacy/data expectations, and requested Strategy metadata /
  AI work;
- creates empty public `https://github.com/Cratis/AI.Distribution` with no branch,
  commit, or manually authored file;
- enables secret scanning and push protection and disables issues, projects, and
  wiki in the generated repository;
- configures repository-scoped read/write deploy key `Cratis AI distribution
  bot`, with the private key stored only as `AI_DISTRIBUTION_DEPLOY_KEY` in
  `Cratis/AI` Actions secrets;
- creates reviewed `distribution-canary` and `npm-stage` environments restricted
  to `main` in `Cratis/AI`;
- records the external state in
  `distribution/remote-repository-state.json` and updates the matrix, rollout
  policy, generated-repository contract, authority state, generator gates, and
  specs;
- adds a protected-environment workflow operation that can initialize the empty
  remote only from deterministic generated fixture bytes using the deploy key.

The deploy key can push only to `Cratis/AI.Distribution`; it cannot create pull
requests, releases, tags, or npm publications. Fresh evidence is 188/188 full
repository specs with focused distribution/generated-repository suites green;
workflow YAML, catalog, stable inventory, syntax, strict JSON, LSP, structural,
focused Markdown, and diff gates pass with unchanged legacy advisories.

After merge, run the reviewed hosted initialization once, then protect `main`
against direct
human/bot pushes. A repository-scoped GitHub App or equivalent PR/release-capable
bot remains required for subsequent generated update PRs and releases.

Zero public targets or product-source contracts are approved. The planned public
artifact, npm package, publication, production canary/promotion, fleet rollout,
legacy retirement, and freeze lifting remain blocked.

## 37. Hosted remote initialization and branch protection — 2026-08-22

Distribution repository authority merged with green CI in Cratis/AI#145 at
`ca28685a9d51b8f506997dd21b951dab89a540d2`. Reviewed hosted run
`https://github.com/Cratis/AI/actions/runs/32573752111` then initialized
`Cratis/AI.Distribution` exclusively from generated fixture bytes.

Observed remote state:

- branch: `main`;
- generated commit: `dd58ae38a1cad0e0c82141a98be929a5a7094a0d`;
- generated tree: `472f288d88c038ad1b72ab1eb42ea384dd1c93ea`;
- author/committer: deterministic `cratis-distribution-fixture-bot` identity;
- root inventory: checksum, manifest, provenance, canonical skill tree, and
  Claude/Codex/Copilot/Cursor/Gemini/Junie/Kiro/Pi native fixture roots only;
- branch protection: administrators enforced, one approval, stale-review
  dismissal, last-push approval, conversation resolution, no force-push, and no
  deletion;
- provisional public description explicitly says fixture-only and unsupported.

After initialization, the one-time write deploy key was removed and
`AI_DISTRIBUTION_DEPLOY_KEY` was deleted from `Cratis/AI` Actions secrets. The
initialization workflow operation was removed. There is no standing distribution
write credential and no direct-push update path.

Strategy intake `Cratis/Strategy#126`, AI#126, and Workflows#68 contain the remote
commit/protection evidence. `distribution/remote-repository-state.json`, the
matrix, rollout policy, generated-repository contract, authority state, and
specs now reflect initialized/protected state.

Remaining blockers are narrower and external: provision a repository-scoped
GitHub App or equivalent that can create generated update PRs and, under separate
release authority, tags/releases; approve real product-source contracts and
public targets; establish `@cratis/ai` package ownership/trusted publishing; and
run production consumer canary/rollback. Publication, promotion, fleet rollout,
legacy retirement, and freeze lifting remain blocked.

## 38. Internal adoption story, public docs, and manual gates — 2026-08-22

The maintainer requested the complete internal development story, an explicit
answer on propagation, public cratis.io documentation for every ecosystem, a
brand surface on cratis.no, and durable issues for every remaining manual gate.

The internal answer is now explicit in the universal **Shared AI Distribution**
rule:

- Cratis maintainers use the repository-local rules/skills already present while
  migration is under canary;
- shared `.ai`, `.agents`, `.claude`, `.github`, and `.pi` trees are never copied
  or synchronized between repositories;
- canonical shared capability comes from `Cratis/AI` and immutable generated
  versions from `Cratis/AI.Distribution` after release approval;
- project facts and minimal host bootstraps remain project-owned;
- installation/update/uninstall never merges, overwrites, or deletes project
  context;
- updates are pinned, canaried, observed, and rolled back by version;
- generated distribution bytes and marketplace wrappers are never hand-edited.

Public documentation work in Cratis/Documentation#60 adds:

- `/ai/getting-started/` for currently available CLI/MCP setup and honest coding-
  skills status;
- `/ai/cratis-maintainers/` for profiles, context, skills, gates, shipping, and
  the no-propagation internal workflow;
- `/ai/ecosystems/` for Agent Skills, Claude, Codex, Copilot, Cursor, Kiro,
  Junie, Gemini, Pi, and npm formats/evidence/status;
- `/ai/trust-and-distribution/` for generated packages, project context, source /
  target approval, canary, rollback, publication, and retirement gates;
- refreshed `/ai/` and `/plugins/` pages and AI navigation that remove obsolete
  folder-copy instructions.

Visual QA passes on the AI landing, ecosystem matrix, maintainer workflow, trust
page, and plugins page; dark/light themes, tables, diagrams, code blocks, cards,
and navigation render correctly. The Astro build renders 1,059 pages and docs
lint reports zero errors. Unrelated main-gate repairs were delivered in
Cratis/Components#167 and Cratis/Chronicle#3804; the reviewed Kotlin Spring Boot
client-doc exception is included in Documentation#60. Remaining unrelated docs
baseline/link repairs are tracked in Documentation#59.

The AI-native brand page and approved messaging merged in Cratis/cratis.no#4.
It presents one canonical skill behavior across hosts, project-local facts,
compiler/spec/CI/human gates, no propagation, reversible generated distribution,
and honest fixture-only availability. Release-time doc and brand updates are
tracked in Documentation#58 and cratis.no#5.

Every remaining manual/external gate has a focused issue:

- Workflows#72 — repository-scoped GitHub App / PR-release bot;
- Workflows#70 — `@cratis/ai` ownership and stage-only npm trusted publishing;
- Workflows#71 — first real consuming-repository install/update/rollback canary;
- AI#148 — first approved product-source contract and public target;
- AI#147 — reviewed vendor marketplace submissions;
- Strategy#126 — generated repository portfolio metadata, ownership, and AI setup;
- Documentation#58 and cratis.no#5 — first-release public copy updates.

No broad propagation is needed or allowed. Publication, real package installation,
production promotion, fleet rollout, legacy retirement, and freeze lifting remain
blocked until the focused issues above pass.

## 39. Credential-ready update and npm verification workflows — 2026-08-22

Internal adoption policy merged with green CI in Cratis/AI#149. Independent work
that does not require the missing credentials is now complete for the two next
manual gates:

- `.github/workflows/distribution-generated-update.yml` verifies a selected
  fixture version without credentials and, only after `distribution-canary`
  approval plus Workflows#72 App secrets, creates a generated branch and pull
  request in `Cratis/AI.Distribution`;
- the GitHub App installation token is scoped to `AI.Distribution`, down-scoped
  to contents and pull-request write, masked, one-hour limited, and automatically
  revoked after the job;
- the workflow validates `0.0.N-fixture`, generates that exact version, never
  pushes `main`, and contains no force-push, self-approval, tag, release, npm, or
  marketplace operation;
- `distribution/update-bot-contract.json` records exact secret names,
  installation scope, permissions, environment, forbidden operations, and the
  Workflows#72 blocker;
- `.github/workflows/distribution-npm-stage.yml` provides the exact future npm
  workflow identity and verifies the private `@cratis/ai` fixture package,
  script/dependency absence, and pack/install/uninstall lifecycle;
- `distribution/npm-stage-contract.json` keeps ownership, trusted publisher,
  OIDC, stage publish, public publish, publication, and promotion disabled until
  Workflows#70 passes;
- focused workflow specs and the full repository suite pass at 195/195.

The public docs work merged in Documentation#60. Components#167 and
Chronicle#3804 restored build/client-snippet gates; AuthProxy#107,
Chronicle#3805, and Cratis/.github#26 repair the remaining rendered-link sources.
Documentation recovery completed: full main build and deploy passed at
`https://github.com/Cratis/Documentation/actions/runs/32577668021`, all new AI
pages are live on cratis.io, and Documentation#59 is closed. The AI-native brand
page is live at `https://cratis.no/ai/`.

The prepared workflows deliberately cannot be used for generated PRs or npm
staging until the focused manual issues provision their credentials/ownership.
No secret, App, package, release, publication, promotion, or retirement authority
is inferred from workflow readiness.

## 40. Engineering distribution classification — 2026-08-22

The next internal-distribution unit classifies before packaging. Repository
evidence identifies eight Cratis-engineering skill targets, but none was approved
or installable and no engineering artifact existed.

This branch adds:

- `distribution/engineering-artifact-matrix.json`, which separates low-trust
  passive skills, effectful passive skills, and executable tooling;
- exact profile intent for application, framework, client, corpus, and
  documentation repositories;
- explicit exclusion of project-owned context/bootstrap files and all evals,
  scripts, rules, agents, prompts, hooks, workflows, tooling, Pi state, and Git
  state from the first passive package;
- a distinct `planned-passive-engineering-release` artifact whose audience is
  `cratis-engineering`, whose eight targets are audience-isolated from public
  targets, and whose materialization/runtime remain disabled;
- reviewed classification for only the lowest-risk first target,
  `cratis-engineering-docs-authoring`: journey, user/model invoked,
  product-neutral, contributor/maintainer, direct-skill/IDE, applicable to
  application/client/corpus/framework repositories, passive but effect-assessed,
  with explicit create/modify confirmation and reversible effects;
- hard dependencies on documentation structure/writing rules, soft degraded
  dependencies on add/edit page targets, and the clean-room authoring contract;
- closed schema/semantic/inventory tests proving all other engineering targets
  remain unclassified candidates and no artifact is installable.

The raw `.ai/skills/write-documentation` source is explicitly not packageable.
The next PR must reconcile it into self-contained canonical engineering source,
remove repository-relative and sibling-skill assumptions from the runtime
payload, add behavior/trigger/collision/portability evidence, and only then
generate a fixture package. Effectful shipping/QA/tracing and executable skill
creation remain separate later packages and security reviews.

## 41. Canonical engineering docs-authoring source — 2026-08-22

The classification unit merged with green CI in Cratis/AI#151. The first target
is now reconciled into canonical source under
`engineering/skills/cratis-engineering-docs-authoring/`:

- a self-contained `SKILL.md` with no `.ai/rules`, parent-path, project-context,
  script, eval, or raw sibling-source dependency;
- one passive site-format reference and a target-local MIT license notice;
- explicit routing to add-page, edit-page, and visual-QA companion targets;
- first-party source blocking for unverified product/API claims;
- four complete document-type cases and five distinct near-miss/blocked cases;
- exact source/reference/assertion/baseline/corpus digests and zero model runs;
- inventory, static validation, malformed/drift mutations, and catalog-validator
  integration.

The `write-documentation` catalog source identity now points at that canonical
path and immutable source commit
`f58bcf7f5cc9fc0e11305ada3b5ecb6fa20953e9`, with dedicated repository-snapshot
evidence. Its source authority is classified through `cratis-ai-composition` /
`capability-composition`, while that contract remains unverified and distribution
input remains denied. The legacy `.ai/skills/write-documentation` directory is
inventory-only and not package input.

The target remains a candidate with `includeInRuntime: false`; the engineering
artifact still has no exact source selection and materialization/runtime remain
disabled. Next: freeze the source/corpus, run repeated behavior/positive-negative
trigger/collision/portability evaluation, obtain owner review, then generate the
first fixture-only engineering package. No installation, publication, promotion,
or retirement authority is granted by source reconciliation.

## 42. Engineering docs-authoring evaluation evidence — 2026-08-22

The canonical source unit merged with green CI in Cratis/AI#152. Evaluation then
ran 16 frozen, tool-free model calls across baseline/skill conditions, two model
variants, and two repetitions each, with context files, ambient skills,
extensions, and network tools disabled.

Calibration evidence is preserved honestly:

- the output contract exposed reason vocabulary, so baseline routing is
  explicitly non-diagnostic;
- skill runs achieved 36/36 routing, outline, and authority matches;
- some deferred/blocked outputs preserved input document type instead of
  normalizing it to null, so strict calibration contract pass remains false;
- the original strict grading failure remains persisted beside the revised
  behavior/contract grading.

A separate held-out pass removed expected decisions and reason-code mapping from
the model prompt:

- four skill runs: 32/32 decisions, 32/32 valid rationales, zero errors;
- four baseline runs: 28/32 decisions;
- recorded skill improvement: +4 decisions.

Bounded Fusion review `validate-f2fa66ec52217d7edf216972982de179` verified the
visible evidence and found one high integrity gap: metadata and output hashes
were validated against mutable per-run metadata rather than exactly against
immutable manifest entries. The correction now requires:

- exact metadata-to-manifest object equality;
- exact condition/model/repetition coverage;
- every output hash to match both metadata and manifest;
- simultaneous output/hash replacement and allowed-value metadata relabeling to
  fail focused mutations.

Per bounded review policy, Fusion was not rerun. The evaluation summary state is
`EVIDENCE_PASS_OWNER_REVIEW_PENDING`; target approval, installation,
materialization, publication, and promotion remain false. Next: owner review,
then a fixture-only engineering package and install/update/rollback canary.

## 43. First engineering fixture package — 2026-08-22

The evaluation unit merged with green CI in Cratis/AI#153. The first engineering
package remains unapproved, but deterministic fixture packaging and lifecycle
mechanics are now implemented:

- catalog artifact `sanitized-engineering-docs-authoring-fixture` allows exactly
  the canonical target's `SKILL.md`, site-format reference, and license notice;
- planned engineering release remains separate, approval-required,
  materialization-disabled, and runtime-disabled;
- `tooling/generate-engineering-distribution-fixture.mjs` creates one canonical
  tree plus Claude, Codex, Copilot, Cursor, Kiro, Junie, Gemini, and private
  Pi/npm fixture adapters;
- every adapter uses exact canonical bytes; manifests, checksums, and an explicit
  non-attestation provenance record are emitted;
- package output excludes project context/bootstraps, scripts, evals, rules,
  agents, prompts, hooks, workflows, tooling, Pi state, and Git state;
- local npm fixture evidence proves pack, install, update from 0.0.1 to 0.0.2,
  rollback to 0.0.1, uninstall, and preservation of `.cratis/PROJECT.md`,
  `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`;
- Pi, Claude Code, GitHub Copilot, Codex, and Gemini isolated lifecycle flows
  pass; Cursor, Kiro, and Junie manifests/byte parity pass with host smoke pending;
- payload/digest/checksum tampering and release-shaped versions fail;
- the read-only hosted fixture workflow has no write, OIDC, PR, publish, release,
  or promotion permission.

Local evidence is in
`distribution/evidence/local-engineering-docs-authoring-fixture-2026-08-22.json`.
The matrix state is `FIXTURE_PACKAGE_PASS_OWNER_REVIEW_PENDING`. AI#154 records
the required owner decision and selection of one documentation-owning repository
for a real canary. Target approval, installation eligibility, materialization,
publication, promotion, and legacy retirement remain false.

## 44. Real Documentation repository engineering canary — 2026-08-22

The first engineering fixture package merged with green CI in Cratis/AI#155;
hosted fixture workflow
`https://github.com/Cratis/AI/actions/runs/32595545234` passed on main.

The package generator now covers canonical, Claude, Codex, Copilot, Cursor,
Kiro, Junie, Gemini, and Pi/npm fixture layouts. Local host lifecycle evidence
passes for Pi, Claude Code, GitHub Copilot, Codex, and Gemini; Cursor/Kiro/Junie
manifests and byte parity pass with host smoke pending.

A real canary then ran against clean `Cratis/Documentation` revision
`72677c19acf2aea71ab5d39138ff350c1f661fe1` using Pi 0.84.2 and
`openai-codex/gpt-5.4-mini`:

- package installed at `0.0.1-engineering-fixture`;
- explicit existing-page routing returned `DEFER_TO_EDIT_PAGE`;
- package updated to `0.0.2-engineering-fixture`;
- implicit new-page routing returned `DEFER_TO_ADD_PAGE`;
- package rolled back to `0.0.1-engineering-fixture`;
- unverified remembered API routing returned `BLOCK`;
- package was removed and the isolated Pi package list became empty;
- the Documentation worktree remained clean;
- `AGENTS.md` and all present/missing project-context/bootstrap states were
  unchanged;
- every model run had tools disabled and no output leaked local paths or
  approval/publication claims.

The first implicit attempt returned `NEEDS_DECISION` because the canary prompt
did not provide a closed output vocabulary. That failure is preserved in the
evidence; the correction supplied the six allowed decision tokens without
revealing the expected case decision, and the rerun passed.

Evidence is in
`distribution/evidence/real-documentation-engineering-canary-2026-08-22.json`.
The matrix state advances only to `REAL_CANARY_PASS_OWNER_REVIEW_PENDING`.
AI#154 still requires a named owner approve or reject the target and its known
calibration limitations. Target approval, general installation eligibility,
publication, promotion, and legacy retirement remain false.

## 45. Canonical documentation companion sources — 2026-08-22

While AI#154 holds the owner decision for the first installable target, the two
soft dependencies that currently cause authoring to degrade are independently
reconciled:

- `engineering/skills/cratis-engineering-docs-add-page/` owns new-page product /
  site ownership, approved destination, ToC/site-navigation wiring, sync, dropped-
  entry detection, and repository documentation gates;
- `engineering/skills/cratis-engineering-docs-edit-page/` owns URL/passage-based
  source discovery, generated-output rejection, minimal source correction, sync,
  and owning snippet/build/lint/link gates;
- both route content design to docs-authoring, visual work to docs-visual-QA,
  new-versus-existing requests to each other, non-Cratis work to skip, and
  unverified product/API behavior to block;
- both are self-contained with one passive reference and license notice; neither
  references legacy rules, project context, parent paths, scripts, or evals;
- 12 exact static cases cover product/site placement, existing page, unresolved
  ownership, visual QA, non-Cratis scope, URL and passage discovery, missing page,
  substantial content design, and missing authority;
- digest, inventory, frontmatter, routing, forbidden-coupling, and oracle drift
  mutations are catalog-gated with zero model runs.

These are source reconciliation artifacts only. Their catalog source identities
still point at legacy source until immutable commits are available, and their
target classifications/evaluations remain incomplete. Next: merge, bind each
source to its immutable canonical revision, classify effects/profiles/dependencies,
then freeze and run companion evaluations before fixture packaging.

## 46. Documentation companion classification — 2026-08-22

Canonical companion sources merged with green CI in Cratis/AI#157. Their
existing catalog source identities now point to the canonical engineering paths
at immutable revision `684d03755bacd40af95463b81b4a0c8b9f088ec1`, with one
repository-snapshot evidence record per source. Legacy `.ai` copies remain
inventory-only.

Both companion targets are now classified as passive, user/model-invoked,
product-neutral journeys for contributor/maintainer personas on direct-skill and
IDE surfaces across application/client/corpus/framework repositories:

- add-page has confirmed reversible create-page and modify-navigation effects;
- edit-page has one confirmed reversible source/navigation modify effect;
- both require repository/task-owner authorization and before-effect path
  confirmation;
- both soft-depend on docs-authoring and optionally depend on visual QA, with
  explicit degrade/omit behavior when absent;
- both use `cratis-ai-composition` / `capability-composition` source authority
  and the clean-room authoring contract;
- both allow only `SKILL.md`, references, assets, and licenses while scripts,
  evals, rules, agents, prompts, hooks, tooling, workflows, and local
  configuration remain forbidden;
- behavior, trigger, negative-trigger, and collision evidence remain missing;
- approval remains candidate and `includeInRuntime` remains false.

The matrix records both as `SOURCE_RECONCILED_NOT_EVALUATED`; raw source
packaging remains forbidden. Next: freeze calibration and held-out routing
corpora for both targets, run repeated evidence, independently review it, then
consider fixture packaging.

## 47. Documentation companion evaluation evidence — 2026-08-22

The companion evaluation is frozen and completed at canonical source revision
`684d03755bacd40af95463b81b4a0c8b9f088ec1`. It contains 16 no-tool model
runs: calibration and held-out passes, each comparing an output-contract-only
baseline with both companion skills across two models and two repetitions.
Runs disabled tools, extensions, ambient skills, context files, prompt
templates, themes, sessions, and network-backed context, and executed from an
isolated temporary directory. Grading requires exact run-directory coverage,
manifest/metadata equality, output hashes, clean exits, and exact case
coverage.

Observed evidence:

- calibration baseline: 39/48 decisions and 45/48 reasons;
- calibration companions: 45/48 decisions and 47/48 reasons;
- held-out baseline: 36/48 decisions;
- held-out companions: 45/48 decisions;
- all 96 held-out rationales were present across both conditions.

The evidence is intentionally not represented as perfect. Companion calibration
mismatches were one missing-owner self-delegation instead of block, one
conservative block instead of non-Cratis skip, and one direct locate instead of
search-locate. Held-out mismatches were one missing-owner self-delegation and
two direct edit executions where the oracle expected delegation to edit-page.
The latter case is explicitly marked ambiguous because both companion skills
were present: direct execution is coherent bundle-level behavior while the
expected value measured per-skill delegation.

Independent Fusion review `validate-29f155f4306b1b6c59de856b42bc42fa`
classified trigger/routing evidence as incomplete and collision evidence as
failed on unambiguous cases, with H04 remaining oracle-ambiguous. It also found
that forced contract injection did not test native skill selection, historical
metadata bound only tools/context restrictions rather than the complete
invocation, the original grader did not enforce the full frozen matrix, and
held-out rationale presence needed distinct terminology. The grader now
enforces the exact plan matrix and held-out fields are named as presence, but
historical metadata remains honestly limited.

Both matrix entries are now `EVALUATED_CORRECTIVE_RERUN_REQUIRED`. A focused
follow-up must separate add-only, edit-only, bundle-level, and native-trigger
conditions; predeclare thresholds; bind complete invocation evidence; and rerun
A04/A06/E02/H03/H04 boundaries. Approval, runtime inclusion, raw source
packaging, installation, publication, and promotion remain false.

## 48. Delivery pivot and Grok/DeepSeek support — 2026-08-22

Maintainer direction explicitly returns the work to the original goal: useful,
shared Cratis skills distributed idiomatically across AI coding harnesses. The
reviewed companion follow-up is preserved separately as do-not-run work and is
not on the first-release critical path.

The first useful public payload is now the self-contained passive
`skills/cratis-fundamentals-concept/` skill rather than the synthetic example.
It is generated from an exact two-file allowlist and remains fixture-only until
source binding and release approval are recorded.

Native adapter coverage now also includes:

- xAI Grok Build through `grok/.grok/skills/`, while retaining Grok's documented
  ability to consume the generated Claude Code marketplace;
- DeepSeek Harness through direct, non-recursive
  `deepseek/.dsh/skills/<skill-name>/SKILL.md` bundles;
- DeepSeek model-provider compatibility metadata, which points users to the
  existing Pi, Claude, Copilot, or DeepSeek Harness package instead of creating
  model-specific duplicate skill bytes.

Both public and engineering generators enforce canonical byte parity for Grok
and DeepSeek Harness. Direct-folder lifecycle smoke tests prove isolated install
and removal. DeepSeek Harness remains developer preview and requires upstream
contract reverification before a supported stable release. Publication and
promotion remain disabled; the immediate path is canonical source binding, a
small passive preview allowlist, one real consuming-repository canary, and the
existing credential/owner gates.

## 49. Profile subscriptions and release hardening — 2026-08-22

A fresh public, maintainer, distribution, security, and official-host review
rejected any claim that the repository was done or broadly usable. It found one
canonical public skill, zero approved/runtime targets, fixture-only packages,
stale local agents/docs, incomplete CI path triggers, an artifact authorization
mismatch, null public source provenance, and no production per-harness release
implementation.

The long-term decision is now explicit:

- `Cratis/AI` owns shared AI behavior and profile composition;
- product repositories own product facts and immutable authority evidence;
- consuming repositories own `.cratis/PROJECT.md`, `.cratis/ai.json`, and
  minimal host bootstraps;
- `Cratis/AI.Distribution` owns bot-generated immutable artifacts;
- public and engineering profiles are product/repository-specific rather than
  one universal corpus;
- all profile packages share an atomic SemVer release train and exact pins;
- updates arrive through reviewed pull requests;
- consuming repositories contribute improvements upstream through issues/PRs,
  never through automatic reverse sync or generated-byte publication.

`distribution/profile-catalog.json` defines five public and eleven engineering
profiles, including Fundamentals, Arc, Chronicle, Components, applications,
Studio, Stagehand, clients, documentation, and corpus work. Project subscription
schema/examples and a comprehensive Pi/package/profile guide now document
project and global installation, pinning, skill filtering, update, rollback,
bootstrap behavior, and contribution flow. Profile packages remain planned and
unpublished; content gaps are explicit.

Immediate review findings corrected in this unit include:

- Guid and non-Guid `EventSourceId<T>` templates are separated;
- artifact catalog, rollout policy, matrix, and generated preview bytes use one
  `cratis-fundamentals-concept-preview` identity;
- fixture generation binds immutable source revision/digest provenance;
- release-relevant CI paths include canonical skills, engineering content,
  distribution, evaluations, evidence, workflows, and issue templates;
- stale planner `Features/` paths, instruction links, and performance
  `.AutoMap()` guidance are corrected;
- broad propagation and reverse-sync workflows are inert;
- README and documentation now lead with profiles, generated distribution,
  source authority, Pi, and exact subscriptions rather than legacy propagation;
- GitHub issue #165 requires @einari and @woksin to assign named profile owners
  and source repositories; existing manual release gates are assigned/tagged.

Production materialization, per-harness root release assets, product-owner
approval, bot credentials, npm authority, and a real public consumer canary
remain explicit blockers. No profile is represented as published.

## 50. Approval-driven profile materialization — 2026-08-23

The production release path now has a concrete fail-closed implementation:

- `tooling/generate-approved-profile-release.mjs` resolves one profile and exact
  SemVer against approved/runtime targets, accepted security, complete passing
  evaluations, verified distribution source contracts, active authoring
  contracts, source publication approval, and an enabled planned artifact;
- immutable skill bytes are read with `git show` from each source revision and
  recomputed against the catalog content digest;
- `tooling/passive-profile-adapters.mjs` emits one install root per profile and
  harness for Agent Skills, Claude, Codex, Copilot, Cursor, Gemini, Grok,
  DeepSeek Harness, Kiro, Junie, and Pi;
- profile adapter inputs are path/content/frontmatter validated, passive-only,
  byte-parity checked, deterministically inventoried, and produce a non-private
  Pi package with no scripts or dependencies;
- release candidate provenance records AI commit, profile, artifact, target
  approvals, immutable source revisions, and content digests; checksums and a
  release manifest bind every generated file;
- `.github/workflows/distribution-approved-profile-release.yml` verifies the
  plan and can open only a protected, bot-authored `AI.Distribution` pull
  request using repository-scoped App credentials; publication and promotion
  remain separate;
- current catalogs correctly reject generation because no profile/target/source
  contract/artifact is approved and runtime-enabled.

The generated repository stores immutable profile/version/harness roots. A
later protected publication unit archives or publishes each harness root and
runs exact remote lifecycle commands. Production code now exists; organizational
approval, credentials, release-asset publication, and the real public canary
remain blockers.

## 51. Authoritative post-#168 delivery checkpoint — 2026-08-23

This section supersedes stale unchecked historical ledger items for current
execution state.

### Repository state

- canonical remote main: `ee905994f6a6278b72241a07e31c54bec84f1b41`;
- worktree: `/Volumes/sourcecode/repos/cratis/AI-review-pilot`;
- intentional checkpoint branch: `chore/post-168-authoritative-checkpoint`;
- divergence from `origin/main`: `0/0` when reconciled;
- open `Cratis/AI` pull requests: none;
- primary `/Volumes/sourcecode/repos/cratis/AI` worktree remains on historical
  local `main` at `b795d5307e20f7f7458a67708b4f26975e223796` and must not be reset;
- one inherited unstaged diff in
  `tooling/passive-profile-adapters.mjs` is formatter-only. It belongs to the
  merged production materializer and will be preserved deliberately, not
  discarded.

Hosted main verification passed for materializer merge `0675633` at
`https://github.com/Cratis/AI/actions/runs/32609491793` and for Pi documentation
merge `ee90599` at
`https://github.com/Cratis/AI/actions/runs/32609687681`.

### Current statistics

| Area | Current count/state |
| --- | --- |
| Skill source identities | 43 total: 35 public, 8 Cratis engineering |
| Canonical sources | 1 public, 3 engineering |
| Legacy `.ai/skills` sources | 39 remain to reconcile; none were deleted |
| Targets | 43 candidate, 0 approved, 0 runtime-enabled |
| Classified targets | 3 |
| Security-accepted targets | 0 |
| Bundles | 6 draft, 0 publishable |
| Profiles | 5 public + 11 engineering, 0 approved |
| Materializable artifacts | 2 fixture/preview artifacts only |
| Runtime-eligible artifacts | 0 |
| Supported published packages | 0 |

The 39 legacy sources are useful migration inputs, not package bytes. The next
release candidate remains `public-fundamentals` with exactly
`cratis-fundamentals-concept`, pending AI#148 and AI#165. The next internal
candidate remains `engineering-documentation` with docs-authoring only, pending
AI#154; add/edit companions remain excluded.

### Distribution and credentials

- `Cratis/AI.Distribution` is public, initialized, secret-scanned,
  push-protected, and has protected `main` with one required approval;
- it still contains fixture-only generated state and is not an installation
  target;
- no repository or protected-environment distribution App secrets are present;
- update-bot state is `WORKFLOW_READY_CREDENTIALS_MISSING`;
- npm is not authenticated locally, package ownership is unconfirmed, and
  trusted publishing is disabled;
- publication, promotion, production canary, and legacy retirement remain
  false.

### Live external blockers

- AI#148 — first public target/source approval; assigned to `einari` and
  `woksin`;
- AI#165 — profile owners and source authority; assigned to both;
- AI#154 — internal docs-authoring owner approval; assigned to both;
- Workflows#72 — repository-scoped distribution App; assigned to both;
- Workflows#70 — npm ownership/trusted publishing; assigned to both;
- Workflows#71 — real public consumer lifecycle canary; assigned to both;
- AI#147 — reviewed marketplace submissions; now assigned to both;
- Stagehand#39 was closed `NOT_PLANNED` with no implementation evidence;
- Workflows#73 now owns the subscriber update PR controller follow-up, consistent
  with Workflows ownership of fleet distribution, canaries, pins, and rollback.
  It is assigned to `einari` and `woksin` and remains unimplemented.

Deferred/non-critical state remains: companion corrective evaluation is outside
the first release; Cursor/Kiro/Junie are structurally validated but await real
host lifecycle evidence; DeepSeek Harness remains preview and must be
reverified before stable support.

### Verification and exact resume actions

Fresh post-reconciliation evidence is 260/260 specs, deterministic catalog and
inventory generation, clean catalog/profile/source/evaluation validation, clean
corpus validation, 17 Markdown files lint-clean, 25 links passing, and clean
diff. This includes the preserved formatter-only materializer change.

Resume in this order:

1. commit this checkpoint plus the formatter-only diff on the intentional branch;
2. run the complete main verification suite and merge the checkpoint PR;
3. verify AI#148/AI#165 for approval; do not self-grant it;
4. if still blocked, make the smallest useful release immediately executable by
   producing deterministic local per-harness release-asset staging from the
   preview without calling it approved or publishable;
5. resolve subscriber-update ownership after Stagehand#39 closure;
6. proceed to protected App/npm/canary/publication only when the corresponding
   external gates are actually satisfied.

## 52. Approval-pending Fundamentals preview assets — 2026-08-23

AI#148 and AI#165 still contain no owner approval. Rather than add generic
validation or wait idly, the first public candidate is now staged into usable,
short-lived review assets without crossing that authority boundary.

`tooling/package-fundamentals-preview-assets.mjs`:

- accepts only the exact `public-fundamentals` /
  `cratis-fundamentals-concept-preview` candidate relationship;
- requires target/source/profile/artifact state to remain candidate,
  non-runtime, fixture-only, and non-publishable;
- reads exact source bytes from immutable revision
  `e9d161a70e25334bb468a33240bcf00f03f87522` and verifies catalog digest
  `f7f7c2c110b3ff3f1b5921ad51fffc449a448bb49aaec2626ecc4d391e9d78a1`;
- generates one root-native deterministic `tar.gz` per passive harness and one
  npm-compatible Pi `.tgz` for Agent Skills, Claude, Codex, Copilot, Cursor,
  DeepSeek Harness, Gemini, Grok, Junie, Kiro, and Pi;
- emits `preview-assets.json`, passive `preview-sbom.json`, and `SHA256SUMS`;
- records `PREVIEW_ASSETS_APPROVAL_PENDING` with approval, supported
  installation, publication, and promotion all false;
- validates tar checksums/paths, archive byte parity, deterministic generation,
  Pi npm install/update/rollback/uninstall, extracted Pi install/list/remove,
  and project context/subscription/settings preservation.

Local evidence at
`distribution/evidence/local-fundamentals-preview-assets-2026-08-23.json`
records 11 assets from review-corrected implementation commit
`9f4f8dc7cd0ede084c1d024fb6f83ad237614355`, generator digest
`3044c0d473b5d2fcda9734547b9246c8d24f5eab9ac361453a7d5f5ea86bc867`,
zero SBOM dependencies/executables, and all focused gates passing.

The single bounded review found three high preview-boundary defects. Corrections
now require the fixed source revision/digest, reject stable/non-preview versions,
set the Pi package `private: true`, and mark Codex installation
`NOT_AVAILABLE`. The read-only **Package Fundamentals Preview Assets** workflow
verifies and uploads the corrected artifacts for seven days. It has no secrets,
write/OIDC, publish, release, push, approval, or promotion authority. Non-Pi harness assets
have archive byte parity only in this unit; existing fixture host evidence
remains separate and exact archive install evidence is still required before a
support claim.

The bounded approval request on AI#148 and first-profile request on AI#165 now
name exact revision/digest and a copy-ready approve/reject response. Workflows#73
tracks the downstream subscriber-update controller after Stagehand#39 closed
`NOT_PLANNED`.
