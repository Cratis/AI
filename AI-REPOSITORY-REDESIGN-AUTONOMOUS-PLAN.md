# Cratis AI Repository Redesign Autonomous Program Plan

**Prepared:** 2026-08-20
**Status:** Canonical program plan; supersedes earlier implementation sequencing
**Handover:** [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md)
**Execution prompt:** [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md)

## 1. Goal

Deliver a trustworthy Cratis AI product and engineering ecosystem. This is not a
general-purpose software-development assistant: it is hyper-focused on the best
possible agentic experience for teams building with Cratis tools and products.
Generic and non-Cratis profiles exist only for routing, exclusion, portability,
and safety-boundary evidence, never as product-scope expansion.

The ecosystem:

- serves Chronicle-only, Arc-only, combined, model-first, contributor, operational, and non-developer use cases;
- treats C#, Kotlin, Java, Elixir, TypeScript, React, and language-neutral workflows as first-class where applicable;
- uses Agent Plugins for portable public skills and optional MCP descriptors;
- supports native wrappers and passive Pi packages without claiming unsupported parity;
- separates public product guidance, contributor context, Cratis engineering behavior, project facts, executable tools, and organization control planes;
- publishes only exact, approved, evidence-bound bytes;
- remains reproducible, pinned, canaried, reversible, and observable;
- learns from external skill systems without redistributing them.

## 2. Accepted architecture

Use **Option A+**:

1. `Cratis/AI` is the sole canonical authoring, composition, approval, evaluation, and generation repository.
2. The mixed authoring repository is never a supported public installation target.
3. Approved public capabilities are projected into a dedicated, automation-managed public distribution repository.
4. The distribution repository is generated, bot-owned, protected, and never manually authored.
5. Immutable tags, archives, npm packages, native wrappers, and marketplace submissions are produced from the same staged logical tree.
6. A separate public product source repository is the fallback only if a generated distribution repository cannot satisfy marketplace governance.
7. Public passive `@cratis/ai`, executable Chronicle.Mcp, optional executable `@cratis/pi`, and engineering packages have separate trust and version boundaries.
8. Third-party skill systems remain upstream. Cratis stores compatibility/provenance metadata only and performs clean-room adaptation of selected ideas.

This program may proceed autonomously under the authority recorded in the canonical handover. Record the architecture on `Cratis/Workflows#68` and related authority records before publication.

## 3. Ownership boundaries

| Concern | Owner |
| --- | --- |
| Public Cratis product capabilities | AI composition plus relevant product maintainer |
| Product APIs, examples, versions, language semantics | Owning product/client repository |
| Contributor build/test facts | Owning repository |
| Cratis engineering rules, agents, prompts, hooks | Separately trusted engineering packages |
| Project architecture, commands, environments, verification details | Consuming repository |
| Governed workflows, profiles, evidence, verdicts, multi-agent panels | Ensemble |
| Durable workers, schedules, credentials, retries, callbacks | Stagehand |
| Fleet distribution, canaries, pins, rollback, wrapper retirement | Workflows |
| Chronicle MCP tools, schemas, credentials, mutations | Chronicle.Mcp |
| Pi-specific executable adapter behavior | Optional separately reviewed `@cratis/pi` |
| Third-party skill behavior and updates | Upstream owner |
| Public Studio facts | Public Studio sources only |
| Private Studio implementation | Studio private repositories; never inferred or published |

## 4. Current state

Completed foundation:

- strict catalog/schema v2 scaffold;
- 43 source records, 43 target records, and 42 migration records;
- evidence-bound ecosystem facts;
- complete mechanically expanded repository ownership inventory;
- fixture-only exact-allowlist materializer with adversarial tests;
- project-context bootstrap contract and fixtures;
- clean-source/public-artifact distinction;
- expanded ecosystem and Agent Plugin evidence;
- third-party Matt Pocock and pstack audits;
- ecosystem/persona/use-case research;
- no runtime-approved target, manifest, package, publication, or source move.

Current worktree facts at this handover are recorded in the autonomous handover and must be refreshed before work.

## 5. Canonical capability model

Extend catalog v2 with:

### Identity and ownership

- stable capability ID and semantic name;
- owner, audience, current source, target source, and authoritative product repository;
- applicable product/package versions and evidence expiry.

### Classification

- `capabilityKind`: primitive, router, journey, gate, explanation, or adapter;
- `invocation`: user, model, or both;
- products, languages, architectures, personas, surfaces, and repository profiles;
- lifecycle: candidate, experimental, approved, deprecated, retired.

### Trust and effects

- passive/executable;
- repository read/write;
- tracker/remote write;
- live-store read/mutation;
- credential access;
- destructive potential;
- required confirmation and authorization.

### Dependencies

- hard, soft, or optional companion;
- missing-dependency behavior;
- tool/runtime requirements;
- project-context requirements;
- collision set and precedence.

### Quality

- positive trigger, negative trigger, collision, behavior, security, and portability evidence;
- reviewer, date, source revision, digest, and approval evidence;
- completion criteria and support claim state.

## 6. Public product families

### Product-neutral core

- Cratis navigator/router;
- concepts, event sources, facts, streams, sequences;
- commands, state views, projections, reducers, reactors, observers;
- validation versus append-time constraints;
- metadata, correlation, causation, tenancy, and compliance;
- direct-client versus Arc versus Screenplay/Stage selection.

### Chronicle clients

- .NET without Arc;
- Kotlin;
- Java;
- Elixir;
- TypeScript;
- shared cross-client contracts and polyglot compatibility.

### Arc

- backend commands, queries, validation, authorization, command execution, EF integration;
- explicit Arc-only behavior;
- Arc plus Chronicle composition.

### Frontend

- Arc React generated clients;
- observable queries and paging;
- MVVM;
- Components dialogs, forms, tables, DataPage, schema editors, toolbars, accessibility.

### Modeling products

- event modeling and diagrams;
- Screenplay authoring/compiler/editor workflows;
- Stage runtime/specification workflows;
- public Studio onboarding/support/issue preparation;
- model-to-code/runtime handoffs.

### Operations

- CLI setup/contexts;
- read-only diagnosis;
- CI automation/machine output;
- terminal Workbench;
- browser Workbench;
- separately authorized recovery and administration;
- Chronicle.Mcp setup/safe-use guidance.

### Contributor and review

- external contributor routing;
- framework/client repository mode;
- Cratis-specific code, security, and performance review;
- product/API/documentation compatibility.

## 7. Human product surface

Generate a browser-readable capability catalog from approved metadata. Every capability page includes:

- what it does;
- when and when not to use it;
- invocation mode;
- products/languages/personas/surfaces;
- prerequisites and dependencies;
- examples;
- observable success criteria;
- side effects and trust;
- related capabilities and bundles;
- tested hosts/versions;
- evidence and support status.

This is a first-class product for GUI-first and non-developer users, not a copy of `SKILL.md`.

## 8. Third-party companion policy

Maintain a repository-only upstream companion registry containing source URL, immutable revision/version, license/owner, supported host, direct install route, trust, writes/dependencies, known collisions, tested Cratis version, review/expiry date, and `bytesIncluded: false`.

Rules:

- no vendoring, mirroring, combined installer, transitive installation, or synchronized copies;
- direct upstream installation only by explicit user/organization choice;
- no Cratis capability depends on a foreign skill name;
- mixed-install trigger/security tests are required before compatibility claims;
- clean-room adaptations use Cratis terminology, examples, structure, ownership, and tests;
- substantial copied expression/code requires preserved notice and third-party review, and is rejected by default.

Initial audited companions:

- `mattpocock/skills@0ab1b63a410a03d3627979a109c8695de27af954`;
- `cursor/plugins/pstack@51a96e0dd838404da19ba83dc70aa21eef71f868`.

## 9. Program phases

### Phase 0: Protect, reconcile, and record authority

- refresh worktree/status/hash baseline;
- preserve all pre-existing work;
- decide branch/worktree strategy for local `main` divergence;
- record Option A+ and autonomy direction on Workflows#68 and related records;
- create a durable program board/issue set if useful;
- update the canonical handover after authority changes.

Gate: no protected work lost; authority and repository strategy are inspectable.

### Phase 1: Persist research and schema contract

- add ecosystem use-case and third-party evaluation records;
- extend catalog/schema v2 with capability, invocation, trust, side-effect, persona, surface, dependency, source-contract, bundle, and companion data;
- add strict schemas and semantic tests;
- add the Cratis skill-authoring contract and human catalog schema;
- preserve v1/v2 equivalence until proven.

Gate: all current and proposed targets are representable without source movement.

### Phase 2: Clean-room workflow pilots

Implement and blindly evaluate:

1. Cratis navigator;
2. evidence-first slice diagnostics;
3. multi-lane Cratis review;
4. domain-expert event modeling;
5. improved skill-authoring validation.

Gate: pilots improve objective behavior/trigger results over baseline and pass similarity/provenance review.

### Phase 3: Representative ecosystem breadth

Add candidate capabilities for Chronicle .NET/Kotlin/Java/Elixir/TypeScript, Arc-only, Arc+React, MVVM, Components, Arc+Chronicle, CLI/read-only operations, browser Workbench, Screenplay, Stage, public Studio, and Chronicle.Mcp guidance.

Gate: product maintainers approve facts/examples at exact revisions; no generic C# translation substitutes for language-native behavior.

### Phase 4: Existing skill migration

Process current skills by dependency/product family. For each target:

- reconcile content against authoritative product sources;
- apply the new authoring contract;
- remove engineering/project dependencies;
- move evals outside runtime payload;
- run behavior, trigger, collision, security, and portability evaluations;
- approve at an exact revision/digest.

Gate: each migrated target is independently releasable; source accounting remains complete.

### Phase 5: Engineering ownership reduction and native design

- classify/reduce rules, agents, prompts, hooks, workflows, and engineering capabilities;
- hand off Ensemble/Stagehand/Workflows/Chronicle.Mcp concerns;
- design host-accurate engineering packages;
- preserve protected hook behavior;
- keep project context project-owned;
- move accepted engineering sources only after dependency/adapter evidence.

Gate: no public capability depends on engineering source; native parity claims are accurate.

### Phase 6: Distribution repository and materialization

- create the accepted generated distribution repository;
- enforce bot-only writes and branch/tag/release protection;
- materialize from an immutable AI source into an empty directory;
- validate exact closure, modes, sizes, digests, licenses, submodules, LFS pointers, secrets, private paths, and discovery roots;
- emit source-to-product manifest and reviewable diff;
- attest source commit, distribution commit, generator/catalog versions, and artifact digests.

Gate: clean reproduction and negative leakage tests pass.

### Phase 7: Public plugin, passive package, and native wrappers

- Agent Plugin root with approved skills and optional MCP descriptor only;
- passive `@cratis/ai` with exact npm allowlist and no lifecycle scripts/extensions;
- generated Claude, Codex/OpenAI, Gemini, Copilot/VS Code, Cursor, Kiro, Junie, and direct-skill metadata where supported;
- no unsupported component parity;
- no executable Pi package yet unless separately justified.

Gate: inventory/version parity and unpacked-artifact validation pass.

### Phase 8: Pi support

- test passive `@cratis/ai` through temporary, user, project, npm, and Git installs;
- verify project trust, filters, pin/update/rollback, gallery metadata, and uninstall;
- create `@cratis/pi` only for genuine Pi-native Cratis value;
- security-review every extension/tool/event hook;
- keep Chronicle tool implementation in Chronicle.Mcp;
- do not port third-party workflow engines.

Gate: passive/executable trust remains separate and Pi behavior is version-pinned.

### Phase 9: Companion interoperability pilots

In disposable repositories, compare Cratis alone, selected Matt skills, mixed Matt/Cratis, pstack alone, and pstack/Cratis in Cursor. Measure routing, collisions, context cost, recursion, unexpected writes, gate compliance, and user correction effort.

Gate: zero unauthorized writes, secret leakage, context overwrite, or ownership violation; compatibility claims name exact versions.

### Phase 10: Representative product/harness pilots

Pilot:

- Chronicle-only JVM or Elixir/TypeScript;
- Arc-only React;
- full Arc+Chronicle+React+MVVM+Components;
- framework/client contributor;
- Screenplay through Stage;
- browser-only Studio/Workbench;
- read-only operations then separately confirmed recovery;
- consultant/client repository;
- Pi passive versus executable.

Gate: installation, behavior, update, rollback, and project-context evidence pass.

### Phase 11: Release and marketplaces

- immutable GitHub release and archives;
- npm trusted/staged publishing with provenance;
- checksums/attestations and executable SBOMs;
- human-reviewed marketplace submissions;
- public support/security/privacy/legal assets where required;
- support claims only after externally observed installation.

Gate: clean checkout reproduces release; no developer-machine publish path.

### Phase 12: Controlled rollout and legacy retirement

- Workflows-owned canary across application/framework/client/non-.NET repositories;
- pin, update, rollback, emergency disable, and partial-failure evidence;
- project-owned bootstrap/context migration;
- remove legacy wrappers/propagation only after D6-equivalent evidence;
- ensure old topology cannot restart accidentally.

Gate: fleet state is observable and recoverable.

### Phase 13: Ongoing product operation

- scheduled ecosystem/client/source drift checks;
- expiry/reverification of evidence;
- product-maintainer review queues;
- skill behavior/trigger regression suites;
- upstream companion re-audits;
- release/support lifecycle and deprecation policy.

## 10. Pull-request sequence

Use small, reversible PRs:

1. autonomous handover/plan/prompt and research records;
2. catalog/schema capability and companion extension;
3. skill-authoring/human catalog contract;
4. navigator pilot;
5. diagnostics pilot;
6. review pilot;
7. domain-expert event-modeling pilot;
8. representative Chronicle language-client pilots;
9. Arc-only and Arc+Chronicle composition pilots;
10. frontend/MVVM/Components pilots;
11. CLI/Workbench/MCP guidance;
12. Screenplay/Stage/public Studio guidance;
13. remaining public skill migrations by family;
14. engineering ownership reduction;
15. engineering source moves/native packages;
16. generated distribution repository/materializer productionization;
17. Agent Plugin and passive npm/Pi package;
18. native wrappers;
19. supply-chain automation;
20. marketplace submissions;
21. controlled rollout;
22. propagation retirement.

The autonomous executor may combine or split PRs when evidence shows a safer review boundary. Never mix unrelated protected work.

## 11. Autonomous execution policy

The executor may autonomously:

- investigate, design, decide, implement, refactor, move, rename, and delete repository content;
- create schemas, catalogs, tools, tests, manifests, packages, workflows, branches, commits, issues, PRs, and repositories when required;
- use subagents, Fusion, worktrees, and model diversity;
- record authority decisions and update issue/PR state;
- run builds, tests, linters, validators, package/install smoke tests, canaries, and rollback exercises;
- proceed on reversible product/technical decisions without asking.

Autonomy does not authorize:

- exposing or inventing secrets;
- bypassing organization/vendor credentials or review;
- rewriting public history, force-pushing protected/shared branches, or deleting repositories/releases/history;
- publishing unapproved targets or private/confidential data;
- customer messages, production data mutation, or destructive live-store operations without the applicable authorization/confirmation model;
- weakening required gates to obtain green status;
- claiming unavailable marketplace/client validation.

When one external dependency is blocked, record it precisely and continue every independent workstream.

## 12. Subagent operating model

- Use Repository Investigator for broad read-only evidence and repository-mode classification.
- Use specialized Backend, Frontend, Spec, Security, Performance, and Code Reviewer agents for matching slices.
- Use Coordinator/Orchestrator for multi-concern phases.
- Use isolated worktrees for parallel writers and independent alternatives.
- Use identical prompts across model-diverse reviewers where disagreement is informative.
- Keep raw bulk output in child contexts; return conclusions and evidence to the coordinator.
- Do not duplicate delegated work.
- Verify actual diffs, tests, and artifacts before accepting a subagent’s summary.
- Bound recursion, child count, time, output, and cost.
- Give one writer ownership of each file/worktree/state item.
- Preserve an inspectable decision/evidence trail for long autonomous work.

## 13. Cross-session continuity

At every completed phase or context-risk point:

1. update the canonical autonomous handover;
2. record current branch/commit/PR/issue/task state;
3. record changed/protected files and validation evidence;
4. record decisions, blockers, rejected alternatives, and next actions;
5. keep the autonomous prompt stable and resumable;
6. create a fresh-session continuation note when context is likely to expire;
7. ensure no critical fact exists only in a conversation transcript.

## 14. Definition of done

The program is complete only when:

- architecture/ownership/distribution decisions are accepted and recorded;
- all current sources and future targets have one owner;
- representative product/language/persona coverage is approved;
- public capabilities are current, self-contained, evaluated, and digest-approved;
- generated public artifacts contain only exact approved files;
- Agent Plugin and supported native wrappers/installations pass real smoke tests;
- passive Pi and optional executable Pi boundaries are verified;
- project context works without overwrite in application/framework/client pilots;
- supply-chain provenance, immutable releases, checksums, and rollback work;
- marketplaces/support claims match externally observed reality;
- Workflows canary and legacy propagation retirement pass;
- no third-party skill bytes are redistributed without explicit derivative approval and attribution;
- scheduled drift, evidence expiry, and deprecation operations exist.

## 15. Execution ledger

### 2026-08-20 — Phase 0 complete; Phase 1 active

- [x] Refreshed and durably recorded branch, upstream, divergence, staged,
  unstaged, untracked, ignored, worktree, branch, diff, and changed-path hash
  evidence.
- [x] Protected the five pre-existing tracked changes and moved redesign work to
  an isolated worktree.
- [x] Re-read all canonical documents, current catalogs, schemas, validators,
  generators, fixtures, and specifications.
- [x] Re-read `.github#24`, Workflows#68, AI#126, and AI#127 through
  authenticated read-only access.
- [x] Recorded Option A+ and autonomous execution authority on Workflows#68 and
  `.github#24`.
- [x] Corrected the foundation source revision and bound source digests to a
  semantic tamper check.
- [x] Recorded the accepted architecture while retaining the unapproved-target
  materialization block.
- [x] Land the autonomous authority, research, and foundation delivery unit in
  [`Cratis/AI#130`](https://github.com/Cratis/AI/pull/130).
- [x] Implement the normalized Phase 1 catalog/schema extensions — merged in
  [`Cratis/AI#131`](https://github.com/Cratis/AI/pull/131).
- [x] Implement the skill-authoring and human-catalog contracts — merged in
  [`Cratis/AI#132`](https://github.com/Cratis/AI/pull/132).
- [ ] Implement clean-room pilots — Navigator source/canonical evidence merged in
  [`Cratis/AI#133`](https://github.com/Cratis/AI/pull/133), and strict held-out
  evidence corrections merged in
  [`Cratis/AI#134`](https://github.com/Cratis/AI/pull/134). The static
  pre-fixture diagnostics pilot is rebased onto that merge on
  `feat/diagnostics-pilot`; source/profile fixtures and model evidence remain
  pending and structurally disabled.

Evidence and exact next actions are in
[`AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md#30-delivery-first-course-correction--2026-08-22).

### 2026-08-22 — Synthetic diagnostics profile fixtures active

- [x] Merge the passive diagnostics pre-fixture pilot in Cratis/AI#135.
- [x] Add content-addressed clean-room profile fixtures for N01/N02/N03/N13.
- [x] Enable exactly those four deterministic profile cases after fixture gates.
- [x] Keep P01-P08/N09/N10 and all source/proof/effect behavior disabled.
- [ ] Deliver fixture infrastructure after green PR CI.

### 2026-08-22 — Source-evidence admission contract active

- [x] Keep all ten source-authority cases disabled at 14/10 totals.
- [x] Define canonical metadata-only source-evidence contract and schemas.
- [x] Add an empty content-addressed CONTRACT_ONLY diagnostics registry.
- [x] Add an offline read-only loader that returns no admitted evidence or proof.
- [ ] Deliver contract infrastructure after full gates and independent review.
- [ ] Obtain first-party product source contracts and owner authority separately.

### 2026-08-22 — Evidence-bound review pilot active

- [x] Define passive clean-room review metadata, routes, envelope/result contracts.
- [x] Add 10 positive and 16 adversarial content-addressed cases.
- [x] Keep model runs, tools, effects, remediation, approval, and runtime denied.
- [ ] Complete validator mutation coverage and all repository gates.
- [ ] Deliver only after independent review and green PR CI.

### 2026-08-22 — Context-window checkpoint

- [ ] Finish and merge the evidence-bound review pilot (Fusion pending).
- [ ] Implement the domain-expert/event-modeling pilot.
- [ ] Execute frozen repeated, held-out, portability, originality, and security gates.
- [ ] Admit real product sources only after owner/revision/permission verification.
- [ ] Create bot-owned generated distribution after all source targets are approved.
- [ ] Build idiomatic marketplace-specific packages/adapters and smoke tests.
- [ ] Canary, prove rollback, then retire legacy propagation safely.

### 2026-08-22 — Review-pilot Fusion correction gate

- [ ] Bind envelope and receipt identities to external evaluated case context.
- [ ] Complete finding after-artifact/range/dimension/claim-basis checks.
- [ ] Add valid EMPTY and nonempty receipt integration fixtures.
- [ ] Make malformed envelope/oracle semantics crash-safe.
- [ ] Rerun all gates and final Fusion before delivery.

### 2026-08-22 — Delivery-first correction

- [x] Finish the four already-known review-pilot findings only.
- [x] Run one bounded final review and fix its two concrete high acceptance
  violations without starting another review loop.
- [x] Merge the review pilot after green CI and stop hardening (#138).
- [x] Deliver one minimal domain-expert/event-modeling pilot PR (#139).
- [x] Verify authoritative Agent Skills, Claude, Codex, Copilot, Cursor, Kiro,
  Junie, Gemini, Pi, and npm requirements.
- [x] Produce the exact bot-repository/credential authority request and continue
  deterministic fixture-only local staging.
- [x] Generate fixture-only canonical, Claude, Codex, Copilot, Cursor, Kiro,
  Junie, Gemini, and Pi/npm adapters from one approved sanitized logical tree.
- [ ] Promote adapters beyond fixture-only after real target approval; activate
  hosted canary and rollback only after generated-repository authority exists.
- [x] Add local pack/install/smoke/uninstall, provenance-record, and checksum
  gates for the fixture-only distribution.
- [x] Add fixture-only candidate staging, canary evidence, stable-pin simulation,
  rollback, emergency disable, audit history, and a read-only manual workflow.
- [x] Bootstrap deterministic local bot-authored generated Git repositories and
  reject authoring content, tampering, human commits, and unapproved production
  plans.
- [x] Register repository creation with Cratis/Strategy, create empty public
  `Cratis/AI.Distribution`, configure a repository-scoped write deploy key,
  secret scanning/push protection, and reviewed canary/npm-stage environments.
- [x] Initialize remote `main` from reviewed hosted generated fixture bytes,
  protect the branch, then remove the one-time deploy key and Actions secret.
- [x] Define the internal maintainer workflow: no shared-folder propagation,
  versioned generated distribution, project-owned context, canary, and rollback.
- [x] Publish the honest AI-native brand story and prepare comprehensive cratis.io
  setup, ecosystem, maintainer, trust, and distribution documentation.
- [x] Record every remaining manual gate as linked AI, Workflows, Documentation,
  cratis.no, and Strategy issues.
- [x] Prepare a least-privilege, environment-gated generated-update PR workflow
  using a one-repository GitHub App token; keep it fixture-only and non-publishing.
- [x] Define separate low-trust passive, effectful passive, and executable
  engineering package boundaries; classify the first low-risk docs-authoring
  target and add a distinct runtime-disabled engineering artifact.
- [x] Reconcile the docs-authoring target into self-contained canonical
  engineering source with immutable source evidence and zero-model-run routing
  cases; raw legacy source remains non-packageable.
- [x] Run frozen calibration and held-out baseline/skill evaluation: 16 bound
  model runs, held-out 32/32 skill decisions versus 28/32 baseline, and one
  bounded independent review with its high run-binding finding corrected.
- [x] Generate deterministic fixture-only canonical, Claude, Codex, Copilot,
  Cursor, Kiro, Junie, Gemini, and Pi/npm packages for the first engineering
  target; prove byte parity, tamper rejection, install/update/rollback/uninstall,
  and project-context preservation.
- [x] Run a real Cratis/Documentation Pi canary with no tools: explicit and
  implicit routing, authority block, fixture update/rollback/remove, clean
  worktree, and project-context preservation pass after one disclosed output-
  contract calibration failure.
- [ ] Obtain owner approval in AI#154 before any installation eligibility.
- [x] Reconcile the new-page placement and existing-page source-discovery
  companion targets into self-contained canonical passive sources with exact
  routing cases and zero model runs.
- [ ] Bind and classify those companions at immutable revisions, then evaluate
  them before adding them to an engineering fixture package.
- [ ] Provision the repository-scoped App credentials from Workflows#72 before
  any generated update PR, tag, release, or publication operation.
- [ ] Keep publication and retirement disabled until explicit approvals pass.
