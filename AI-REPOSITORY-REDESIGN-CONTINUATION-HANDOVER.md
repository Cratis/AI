# Cratis/AI Redesign — Canonical Continuation Handover

> **Superseded as the operational entry point.** The maintainer authorized the
> complete autonomous program and accepted the updated Option A+ recommendation.
> Continue from
> [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md),
> [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-PLAN.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-PLAN.md),
> and
> [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md).
> Preserve this file as foundation decision history.

**Prepared:** 2026-08-20
**Status:** Foundation implemented; distribution and source movement remain blocked
**Verdict:** Catalog, inventory, and fixture gates exist; D1 remains unresolved
**Plan:** [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md)
**Next prompt:** [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md)

## 1. Purpose

This is the canonical handover for continuing the Cratis/AI redesign. It replaces
`AI-REPOSITORY-REDESIGN-NEXT-SESSION-HANDOVER.md` as the operational entry
point.

The detailed evidence and reasoning remain in
[`AI-REPOSITORY-REDESIGN-REEVALUATION.md`](./AI-REPOSITORY-REDESIGN-REEVALUATION.md).
The older handovers remain historical records and must not be used to resume the
old PR-2.

## 2. Read order and authority

Read these completely before making a change:

1. this handover;
2. `AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md`;
3. `AI-REPOSITORY-REDESIGN-REEVALUATION.md`;
4. `AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md`;
5. `Documentation/public-product-architecture.md`;
6. `Documentation/skill-classification-audit.md`;
7. all three catalogs, schemas, validator files, and catalog specs;
8. the old handovers only as superseded decision history.

External authority, from highest to lowest for this work:

1. accepted organization ownership and migration records;
2. merged current repository policy and maintainer decisions;
3. live official ecosystem specifications and vendor documentation;
4. this evidence-backed recommendation;
5. superseded untracked handovers and abandoned experiments.

The current cross-repository authority records are:

- [`Cratis/.github#24`](https://github.com/Cratis/.github/issues/24): AI is the
  shared corpus, distribution is frozen, and the replacement must be accepted
  and canaried;
- [`Cratis/Workflows#68`](https://github.com/Cratis/Workflows/issues/68): the
  replacement distribution artifact, pinning, override, rollout, rollback, and
  wrapper-retirement model remains unresolved;
- [`Cratis/AI#126`](https://github.com/Cratis/AI/issues/126): corpus-only cleanup
  and generic gate follow-up;
- [`Cratis/AI#127`](https://github.com/Cratis/AI/issues/127): the earlier approved
  one-off history purge happened, while residual GitHub pull-request refs remain.

Do not treat this handover as approval of a still-open organization decision.

## 3. What is complete

The reevaluation completed:

- a fresh protected-worktree baseline;
- complete reading of the known redesign record;
- repository, Git history, GitHub issue/PR, and sibling-repository ownership
  discovery;
- live official-source verification of Agent Plugins, Agent Skills, MCP,
  `gh skill`, every registered Agent Plugin client, direct skill targets,
  native wrappers, Pi, Junie, and npm supply-chain requirements;
- Agent Plugin conformance analysis against a materialized-artifact model;
- per-harness capability and project-context analysis;
- a complete 43-skill second-pass audit;
- current artifact counts and ownership risks;
- a public artifact and supply-chain threat review;
- comparison of five engineering/distribution alternatives;
- a revised target tree, phase sequence, and pull-request plan;
- the canonical reevaluation report and revised implementation prompt.

The session also applied bounded evidence corrections:

- expanded `catalog/ecosystem-versions.json` with current MCP, client, direct
  skill, Pi, and npm evidence;
- made catalog parsing strict instead of mutating trailing commas with a regex;
- made the ecosystem semantic validator require the expanded records;
- added strict-parser and ecosystem regression specs;
- marked the prior handovers and ownership document as superseded or revised by
  the reevaluation.

No skill, rule, agent, prompt, hook, workflow, adapter, or engineering source was
moved or deleted. No plugin or package manifest was created. Nothing was
published, installed, committed, pushed, or submitted to a marketplace.

## 4. Executive outcome

The public Cratis skills product remains worthwhile. The following principles
are sound:

- Agent Plugins 1.0 is the canonical portable format;
- only Agent Skills and MCP are portable;
- public skills and engineering behavior require separate artifact boundaries;
- public packages use exact positive allowlists;
- passive skills remain separate from executable MCP and Pi packages;
- every public skill needs self-contained current guidance, behavior evals,
  positive/negative trigger evals, collision testing, and explicit approval;
- Stagehand owns managed control-plane behavior;
- Ensemble owns governed workflow, policy, profile, and evidence behavior;
- Workflows owns fleet distribution mechanics, canaries, and rollback.

The following earlier conclusions are not implementation-ready:

- a mixed source checkout cannot itself be the public runtime artifact;
- `engineering/skills/` is unsafe because recursive skill discovery can expose it;
- no single native engineering package can provide component parity everywhere;
- `.cratis/PROJECT.md` is not automatically discovered by verified harnesses;
- broad propagation retirement remains a proposal until Workflows#68 and pilots
  prove the replacement;
- the existing catalogs are audit scaffolding, not release safety proof.

## 5. Recommended architecture

The preferred evidence-backed option is:

> One canonical source repository plus a generated, public-only release
> tree/ref/archive.

The source branch remains the corpus and authoring home. Public publication runs
only against a clean materialized tree containing exact approved files.
Engineering Agent Skill source uses a deliberately non-auto-discovered path such
as `engineering/capabilities/`, never `engineering/skills/`.

If a generated public ref/archive cannot satisfy real Cursor, Gemini, Kiro, and
other Git-root marketplace pilots without exposing source-only content, use a
separate public product repository instead of weakening the boundary.

This recommendation must be accepted through the Workflows#68 decision process
before source trees or manifests are created.

## 6. Project-context conclusion

Keep `.cratis/PROJECT.md` as the canonical project-owned content source, but do
not describe it as a natively discovered cross-harness instruction file.

The smallest safe fallback is:

- root `AGENTS.md` for Copilot, Codex, Cursor, OpenCode, and Pi;
- root `CLAUDE.md` importing `.cratis/PROJECT.md` for Claude;
- root `GEMINI.md` importing `.cratis/PROJECT.md` for Gemini;
- explicit user/managed configuration only where official host behavior proves
  equivalent discovery.

These bootstraps are minimal, project-owned, and never propagated as shared
corpus content. Migration reads `.cratis/PROJECT.md` first and legacy
`.agents/PROJECT.md` only as fallback. Never overwrite or automatically merge
project-owned content.

## 7. Skill decision state

Current sources remain:

- 35 public-product candidates;
- 8 Cratis-engineering skills.

The eight engineering skills are:

- `add-cratis-docs-page`;
- `add-traces`;
- `cratis-csharp-standards`;
- `edit-cratis-docs`;
- `qa-cratis-docs`;
- `ship-changes`;
- `skill-creator`;
- `write-documentation`.

Decisions retained:

- split `add-business-rule` into Arc command validation and Chronicle event
  constraints;
- retain focused performance review after removing contradictions and overlap;
- keep `add-traces` and broad C# conventions under engineering ownership;
- keep semantic `cratis-` public names;
- keep vertical-slice consolidation as an evaluation-gated experiment, not an
  approved merge.

No target is approved for runtime publication.

## 8. Worktree safety

At the final reevaluation checkpoint:

- local `main` was at `158bcab`;
- `origin/main` was at `b795d53`;
- local `main` was four commits behind;
- there were no staged files.

Protected pre-existing modified files:

- `.ai/hooks/agent-stop.md`;
- `.ai/hooks/pre-commit.md`;
- `.ai/hooks/scripts/validate-ai-setup.sh`;
- `.gitignore`;
- `Documentation/index.md`.

Their baseline SHA-256 values are recorded in the reevaluation session and were
unchanged at completion. The next session must record fresh hashes because the
worktree may have changed since this handover.

The repository also contains untracked redesign files and tool-created
`.pi/delegate`/`.pi/fusion` artifacts. Do not treat those runtime artifacts as
policy, do not clean them merely for tidiness, and never include them in a
runtime package.

Do not pull, merge, rebase, reset, or switch branches until a new session has
protected every pre-existing change and decided how to handle the four-commit
remote divergence.

## 9. Validation evidence

Final reevaluation signals:

- catalog validation: passed for three catalogs and three schemas;
- catalog specs: 10/10 passed;
- strict JSON parsing: passed;
- AI corpus validation: passed with the same three pre-existing advisory
  warnings;
- scoped Markdown lint: zero findings with line-length disabled for legacy
  long-form tables and URLs;
- LSP diagnostics: clean;
- full session diagnostics: clean;
- `git diff --check`: passed for tracked diffs;
- protected hashes: unchanged.

The canonical continuation artifacts were then validated separately:

- scoped Markdown lint: zero findings across the handover, plan, prompt, report,
  and supersession notes;
- LSP diagnostics: zero findings;
- full session diagnostics: zero findings;
- direct link checks: 8/8 links in this handover, 4/4 in the implementation
  plan, and 1/1 in the prompt passed;
- catalog validation and all 10 catalog specs remained green;
- protected hashes remained unchanged.

The earlier comprehensive report link validation checked 41 links. Forty
passed. The unauthenticated crawler
received 404 for private `Cratis/Ensemble#13`; authenticated read-only `gh issue
view` had already verified it. Record that as an authentication limitation, not
a broken source.

Unavailable or deliberately not run:

- local `gh skill` because GitHub CLI 2.71.2 lacks it;
- plugin/native validators because manifest creation was forbidden and no
  artifact exists;
- paid or unavailable client smoke tests;
- npm organization membership and trusted-publisher permission;
- marketplace publication or review.

## 10. Completed foundation scope

Do **not** resume the old engineering-source PR-2.

The bounded implementation completed:

1. record or explicitly defer the Workflows#68 distribution decision;
2. implement catalog/schema v2 with separate sources, targets, migrations,
   approvals, claims/evidence, and artifact definitions;
3. create a complete schema-backed ownership inventory for every current
   artifact;
4. create a fixture-only exact-allowlist materializer with adversarial path,
   symlink, archive, and recursive-discovery tests;
5. specify and fixture-test project-owned context bootstraps;
6. update decision documentation additively;
7. produce a prompt for the first approved source-move session.

This scope creates no live target tree, manifest, package, installation,
publication, propagation change, or source move.

## 11. Acceptance criteria for the next scope

The next scope is complete only when:

- all 43 current skill sources and every non-skill artifact are accounted for;
- split and merge outputs are independently representable and approvable;
- every claim is directly bound to evidence;
- no candidate can enter runtime without approval evidence, security disposition,
  source revision, and content digest;
- a fixture public artifact is built from an empty directory and exact paths;
- all symlinks, special files, escapes, duplicates, and forbidden content fail;
- a recursive discovery fixture proves engineering skills cannot leak through
  `--all`;
- project-context fixtures prove the bootstrap contract without overwriting
  project content;
- all validators/specs/lint/LSP/session diagnostics pass;
- protected work remains unchanged;
- unresolved decisions and unavailable validators are stated honestly.

## 12. Stop conditions

Stop and ask rather than infer if:

- Workflows#68 has a materially different accepted decision;
- maintainers require direct installation from the mixed source branch;
- a marketplace cannot consume the proposed public-only ref/archive;
- project bootstraps are rejected but no verified managed discovery mechanism
  replaces them;
- a source move would touch protected uncommitted work;
- a target cannot be made self-contained without copying engineering policy;
- a high-risk skill lacks an explicit security/confirmation model;
- validation would require adding a dependency manifest or global tool change.

## 13. Conditional next prompt

The completed foundation prompt remains as the execution record:

- [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md)

The dormant first-source-move prompt is:

- [`AI-REPOSITORY-REDESIGN-FIRST-SOURCE-MOVE-PROMPT.md`](./AI-REPOSITORY-REDESIGN-FIRST-SOURCE-MOVE-PROMPT.md)

Do not execute it until Workflows#68 records an accepted distribution decision
and every precondition in that prompt has accepted evidence. Do not combine it
with the old PR-2 prompt.

## 14. Foundation implementation evidence — 2026-08-20

Authenticated, read-only issue discovery found no accepted replacement
architecture. Workflows#68 remains open. Its current maintainer comment says
the fail-closed freeze/control toolkit landed, while the authoritative
distribution model, versioning and override policy, canary, wrapper retirement,
and freeze lifting remain open. The implementation therefore recorded
`distributionDecision.state: unresolved` and created no live target tree,
manifest, package, install instruction, release ref, publication, propagation
change, commit, push, or pull request.

The foundation now includes:

- 43 schema-backed source records and 43 independently represented target
  records: 35 public candidates and eight engineering candidates;
- 42 migration records accounting for all sources exactly once, including an
  independent two-target business-rule split and one two-source vertical-slice
  merge experiment;
- evidence-bound ecosystem facts and separate roadmap coverage versus released
  claim state;
- a blocked planned public artifact plus one sanitized fixture-only artifact;
- a complete repository inventory whose mechanically expanded groups carry
  expected path counts and sorted SHA-256 path-list digests;
- strict unsupported-schema-vocabulary failure;
- exact-allowlist materialization, content hashing, safe fixture archive
  round-trip, and adversarial path/resource tests;
- recursive engineering-skill discovery leak evidence;
- project-context resolution and minimal-bootstrap fixtures for application,
  framework, both-file, neither-file, and existing-bootstrap cases.

No public target is approved, no target sets `includeInRuntime`, and a green
foundation validation must not be described as plugin or release conformance.
Detailed command evidence and limitations are in
[`Documentation/redesign-foundation-validation.md`](./Documentation/redesign-foundation-validation.md).
