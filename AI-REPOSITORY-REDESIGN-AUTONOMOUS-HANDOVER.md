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
