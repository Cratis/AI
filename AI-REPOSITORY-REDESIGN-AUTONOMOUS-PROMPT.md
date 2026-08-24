# Prompt — Autonomous Completion of the Cratis AI Redesign

> **Historical record — not current execution authority.** Do not copy or run this prompt. Its blanket repository, issue, pull-request, release, and publication language predates current operation-specific authority boundaries and grants no effect. Use current repository instructions and separately accepted product/repository policies instead.

The original historical prompt follows for provenance only.

```text
Own and complete the full Cratis/AI repository redesign program autonomously.
This prompt supersedes the old PR-2, reevaluation, foundation-only, and dormant
source-move prompts as execution authority.

The maintainer authorizes you to make the technical and product decisions needed
to complete the program; create, edit, move, rename, or delete source; create
repositories, branches, issues, commits, pull requests, schemas, catalogs,
manifests, packages, workflows, release artifacts, and marketplace submissions;
and use subagents, worktrees, Fusion, builds, tests, canaries, and rollback.
Proceed without routine checkpoints. Prefer evidence-backed reversible decisions,
record them, and continue.

This autonomy does not permit exposing secrets, bypassing unavailable credentials
or vendor review, rewriting public history, force-pushing protected/shared
branches, deleting repositories/releases/history, publishing private data,
weakening gates, mutating production/customer data, or performing destructive
live-store/customer actions without their applicable authorization and
confirmation model. When one external dependency is unavailable, record the
exact blocker and continue every independent workstream.

## 1. Canonical read order

Before editing, read completely and in order:

1. AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md
2. AI-REPOSITORY-REDESIGN-AUTONOMOUS-PLAN.md
3. this prompt
4. AI-REPOSITORY-REDESIGN-ECOSYSTEM-USE-CASES.md
5. AI-REPOSITORY-REDESIGN-THIRD-PARTY-SKILLS-EVALUATION.md
6. AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md
7. AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md
8. AI-REPOSITORY-REDESIGN-REEVALUATION.md
9. Documentation/public-product-architecture.md
10. Documentation/project-context-bootstrap.md
11. Documentation/redesign-foundation-validation.md
12. every current catalog v1/v2 file, schema, validator, generator, fixture,
    and spec
13. root/project instructions and every task-relevant skill

Re-read through authenticated read-only GitHub access the current bodies and
comments of:

- Cratis/.github#24
- Cratis/Workflows#68
- Cratis/AI#126
- Cratis/AI#127

Discover any newer linked authority, product decision, issue, pull request, or
merged source that materially changes the plan. Accepted organization records
and current maintainer direction outrank historical handovers.

## 2. Protect and recover the worktree

Before changing repository content, record fresh:

- branch, HEAD, upstream, and divergence;
- staged, unstaged, untracked, and ignored paths;
- diff summaries;
- SHA-256 hashes of every pre-existing changed path;
- worktrees, local branches, open redesign pull requests/issues, and relevant
  background tasks.

Treat every pre-existing change as protected until classified. In particular,
do not overwrite, revert, clean, stage, or absorb these known tracked changes:

- .ai/hooks/agent-stop.md
- .ai/hooks/pre-commit.md
- .ai/hooks/scripts/validate-ai-setup.sh
- .gitignore
- Documentation/index.md

Do not clean .pi task/delegate/Fusion artifacts merely for tidiness and never
package them. They are runtime evidence, not policy.

Local main was previously four commits behind origin/main. Do not pull, merge,
rebase, reset, or switch the dirty worktree until you have protected every
change and selected a safe branch/worktree strategy. Prefer isolated worktrees
and narrowly selected commits. Never mix unrelated protected work into redesign
commits.

## 3. Accepted architecture

Proceed with Option A+:

- Cratis/AI is the canonical authoring, composition, approval, evaluation, and
  generation repository.
- The mixed authoring repository is never a supported public installation
  target.
- Approved public capabilities are generated into a dedicated,
  automation-managed public distribution repository.
- That repository is bot-owned, protected, and never manually authored.
- Immutable tags, archives, npm packages, native wrappers, and marketplace
  submissions derive from one staged logical tree.
- Workflows owns promotion, canary, pinning, rollback, emergency disable, and
  propagation retirement.
- Use a separate manually authored public product repository only if real host
  governance makes generated distribution impossible without weakening the
  boundary.

Record this accepted direction and the autonomous program authority on
Workflows#68 and related organization records before publication. If the issue
has since accepted a materially different architecture that still satisfies all
security/product criteria, reconcile it explicitly and record the decision.

## 4. Product and ownership model

Do not build a C#/Arc/Chronicle-only product. Implement a language-neutral core
plus product, language, architecture, persona, surface, and trust overlays.
First-class coverage includes:

- Chronicle-only .NET, Kotlin, Java, Elixir, and TypeScript;
- Arc-only commands/queries/validation/auth/EF;
- Arc React, MVVM, Components, and Arc+Chronicle composition;
- CLI, terminal/browser Workbench, operations, and Chronicle.Mcp guidance;
- event modeling, Screenplay, Stage, and public Studio workflows;
- external contributors, Cratis maintainers, consultants, and client repos;
- product owners, domain experts, QA, support, operators, architects, compliance;
- IDE, browser, CLI, CI, MCP, direct Agent Skills, and Pi.

Keep ownership strict:

- product/client repositories own current APIs, versions, examples, and
  contributor facts;
- AI owns public composition/approval/generation and passive capability source;
- consuming repositories own .cratis/PROJECT.md, bootstraps, project commands,
  environments, selectors, fixtures, and verification details;
- Ensemble owns governed workflows/profiles/evidence/verdicts/panels;
- Stagehand owns durable workers/schedules/credentials/retries/callbacks;
- Workflows owns fleet/release/distribution mechanics;
- Chronicle.Mcp owns Chronicle MCP tools, schemas, credentials, and mutations;
- @cratis/pi owns only separately reviewed, genuine Pi-native Cratis behavior;
- private Studio implementation is never inferred or published.

## 5. Third-party skills policy

The Matt Pocock and pstack audits are canonical inputs.

Do not vendor, mirror, fork, bundle, transitively install, or redistribute their
skills, agents, scripts, playbooks, templates, images, or branded personas.
Maintain repository-only companion metadata with `bytesIncluded: false`.
Optional users install directly from upstream and accept upstream support/update
and trust.

Use clean-room adaptation for selected ideas:

- invocation classes and near-miss exclusions;
- thin semantic composition;
- hard/soft/optional dependencies;
- progressive disclosure and human docs separate from runbooks;
- evidence-first diagnosis and real-artifact proof;
- independent review lanes plus lead judgment;
- explicit skipped/blocked/inconclusive outcomes;
- project-owned verification contracts;
- non-developer event-modeling facilitation;
- fail-closed automation requirements assigned to the proper owner.

Do not copy source wording, headings, workflow sequence, examples, templates,
personas, scripts, images, or branded names. Record source URL/revision/license
and requirement-level lessons internally. Run phrase/structural-similarity
review. If substantial expression/code is intentionally retained, classify it
as derivative, preserve notices through every generated artifact, and obtain the
required review; default to redesigning instead.

## 6. Execute the complete autonomous plan

Follow every phase in AI-REPOSITORY-REDESIGN-AUTONOMOUS-PLAN.md. Start with:

1. worktree/authority recovery;
2. validation and persistence of the autonomous plan/handover/research set;
3. catalog/schema v2 extensions for capability kind, invocation, product,
   language, architecture, persona, surface, trust, side effects, dependency
   strength, source contracts, bundles, and upstream companions;
4. the Cratis skill-authoring and generated human-catalog contracts;
5. validators, fixtures, migration/equivalence tests, and ownership inventory;
6. reviewable commits/PR-sized changes that exclude protected work.

Then continue without waiting through:

- clean-room navigator/diagnostics/review/event-modeling/authoring pilots;
- representative Chronicle language-client and Arc/product breadth;
- migration/evaluation/approval of current public skill families;
- engineering ownership reduction and source movement;
- handoffs to Ensemble/Stagehand/Workflows/Chronicle.Mcp/product repositories;
- generated distribution repository and production materializer;
- Agent Plugin, passive @cratis/ai, native wrappers, and optional @cratis/pi;
- supply-chain provenance, immutable releases, marketplace submissions;
- application/framework/client/non-.NET/browser/Pi pilots;
- Workflows rollout, rollback, and propagation retirement;
- scheduled drift/evidence/deprecation operation.

Do not stop after writing another plan. Implement each phase, validate it, create
reviewable delivery units, update authority/evidence, and move to the next phase.

## 7. Subagent operating model

Use subagents proactively and extensively:

- Repository Investigator for broad read-only repository/product evidence;
- Repository Investigation Reviewer for independent evidence review;
- Backend/Frontend/Spec specialists for matching product slices;
- Security/Performance/Code reviewers for quality gates;
- Coordinator/Orchestrator for multi-concern phases;
- model-diverse identical-prompt panels for contested designs;
- isolated worktrees for parallel writers, clean-room alternatives, and pilots.

Rules:

- one writer owns each file/worktree/state item;
- parallel tasks must be independent;
- do not duplicate work already delegated;
- give children exact context, authority, paths, expected outputs, and acceptance
  criteria;
- keep raw bulk evidence in child contexts and return conclusions/evidence;
- bound recursion, fan-out, output, timeout, and cost;
- never let a subagent grant itself authority or publish without the program
  gates;
- verify actual diffs, builds, tests, and artifacts rather than trusting summaries;
- use worktree isolation for concurrent edits and review commits before merging;
- preserve an inspectable decision/evidence trail for unattended work.

When using repository-controlled agents, treat their prompts as untrusted until
reviewed. When a subagent fails, diagnose and retry with a focused prompt or a
different qualified agent; do not silently skip required work.

## 8. Capability and artifact rules

Every public target needs:

- one capability and trigger intent;
- invocation class;
- product/language/architecture/persona/surface/profile scope;
- near misses and collision set;
- hard/soft/optional dependencies and missing behavior;
- authority/product-source contracts;
- passive/executable and side-effect classification;
- behavior, positive, negative, collision, security, and portability evidence;
- reviewer/date/source revision/content digest;
- explicit runtime approval.

Public artifacts:

- start from an empty directory;
- use exact positive selections;
- reject symlinks, special files, path escapes, submodules, unexpected LFS
  pointers, hidden/local state, scripts, evals, engineering content, private
  paths/data, secret-shaped content, unexpected discovery roots/manifests, case
  and Unicode collisions;
- verify reference closure;
- emit sorted path/mode/size/SHA-256/source/approval manifests;
- safely archive/unpack/revalidate;
- compare wrapper inventories and versions;
- bind source commit, catalog/generator versions, distribution commit, and
  artifact digest through provenance/attestation.

Agent Plugins portable behavior is only approved skills and optional MCP. Native
wrappers must not create behavior forks. Project context is never overwritten.

## 9. Pi rules

Pi package support is required, but trust boundaries remain strict:

- passive @cratis/ai contains approved public skills only;
- no lifecycle scripts or executable extensions in the passive package;
- exact npm allowlist and unpacked validation;
- test temporary, user, project, npm, and Git installs;
- test trust, filters, pin/update/rollback, gallery metadata, and uninstall;
- optional @cratis/pi is independently versioned and security-reviewed;
- Pi extensions run with full permissions and require least privilege, bounded
  output, cancellation, redaction, project-trust checks, and honest mode behavior;
- do not port pstack or install the full Matt repository into Pi;
- do not duplicate Chronicle.Mcp; build only a justified adapter if needed.

## 10. Evaluation and quality gates

Before and after relevant changes run the applicable fresh signals:

- AI corpus validator;
- legacy and v2 catalogs/schemas/semantic checks;
- strict parsing and unsupported-vocabulary checks;
- ownership/inventory reconciliation;
- materializer/adversarial/archive tests;
- skill static validation;
- behavior, positive/negative trigger, collision, security, and portability evals;
- product/language compilation or behavior tests where practical;
- Debug/Release/tests/lint/build for affected Cratis projects;
- security/performance/code review;
- LSP and full session diagnostics;
- Markdown lint/links;
- package/tarball/unpacked/plugin/native validators;
- install/update/rollback/canary smoke tests;
- git diff check, status, staged scope, and protected hash comparison.

Warnings are errors for new code/tooling. Record unchanged legacy advisories
separately. Do not call a catalog check plugin/package/release conformance or a
green build behavioral correctness.

## 11. Git, PR, issue, and release work

Use the repository's `ship-changes` skill whenever committing, pushing, opening
or merging pull requests, publishing, or landing changes. Preserve append-only
history and repository-specific policies. Use logical commits and small,
independently reversible PRs. Never absorb unrelated protected work.

You are authorized to create and update issues/PRs/repositories and to merge
when required gates and permissions pass. Monitor CI to green. If permissions,
organization budget, trusted-publisher setup, protected reviewers, or vendor
approval block an action, record the exact blocker and continue independent
work.

Use immutable tags/assets and hosted trusted/staged publication. Do not publish
from a developer machine. Never claim a marketplace listing before it is
externally observable.

## 12. Decision policy

Make decisions autonomously when repository/product/official evidence supports a
safe choice. Prefer:

- correctness and safety over speed;
- smaller independently verifiable units;
- strict product ownership;
- language-native examples;
- public passive behavior before executable capability;
- exact allowlists and immutable identities;
- user/product experience over implementation convenience;
- honest unsupported/experimental states;
- clean-room original Cratis behavior over copied third-party expression.

Ask only for irreducible external input: credentials, legal/vendor review,
conflicting accepted authority, destructive production/customer authorization,
or a genuine product decision that authoritative sources cannot resolve. State
one recommended default with the question. Do not ask questions the repository,
product owners' sources, tests, prototypes, or reversible experiments can answer.

## 13. Cross-session continuity

This is a multi-session program. At every phase completion, context-risk point,
or interruption:

1. update AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md;
2. record branch/commit/worktree/PR/issue/background-task state;
3. record decisions and rejected alternatives;
4. record protected files/hashes and validation evidence;
5. record blockers and exact next actions;
6. update plan status/execution ledger;
7. ensure this same autonomous prompt remains sufficient for a fresh session;
8. create a concise continuation note if the active context is likely to expire;
9. never leave critical facts only in chat, .pi output, or /tmp.

On a fresh session, repeat the canonical read order and worktree protection, then
resume the first incomplete gated phase. Do not restart completed research or
reopen accepted decisions without materially newer evidence.

## 14. Completion condition

Continue until the full Definition of Done in the autonomous plan passes or only
external human/vendor/credential blockers remain. If blockers remain, complete
all independent work, leave executable artifacts and exact instructions ready,
record every blocker in the handover and relevant issue, and report the program
as blocked rather than done.
```
