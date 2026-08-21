# Cratis/AI Redesign — Next Session Handover

> **Superseded on 2026-08-20.** The required reevaluation is complete. Continue from [`AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md`](./AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md), [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md), and [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md). Do not resume the old PR-2 scope from this historical handover.

**Prepared:** 2026-08-20
**Next scope:** complete repository and ecosystem reevaluation before PR-2
**Canonical architecture:** `AI-REPOSITORY-REDESIGN-HANDOVER.md`
**Canonical next prompt:** `AI-REPOSITORY-REDESIGN-REEVALUATION-PROMPT.md`
**Status:** PR-2 deferred until reevaluation completes

## 1. Read order and authority

The next session must read these files completely, in this order:

1. `AI-REPOSITORY-REDESIGN-HANDOVER.md`
2. this handover
3. `README.md`
4. `.ai/README.md`
5. `.ai/rules/general.md`
6. `.ai/rules/managing-ai-rules.md`
7. `Documentation/public-product-architecture.md`
8. `Documentation/phase-0-verification.md`
9. `Documentation/skill-classification-audit.md`
10. `catalog/public-skills.yml`
11. `catalog/product-coverage.yml`
12. `catalog/ecosystem-versions.json`

The maintainer decision update near the beginning of the main handover is
authoritative where older sections or legacy repository instructions conflict.

## 2. What has been completed

The first implementation scope completed:

- a fresh worktree and diff baseline;
- protection of pre-existing work;
- official-source ecosystem re-verification;
- npm name availability and scope verification;
- a complete audit of all 43 current skills;
- deny-by-default public catalog and schema;
- product/language coverage catalog and schema;
- ecosystem version/source registry and schema;
- dependency-free catalog validation and specs;
- public-versus-engineering ownership documentation;
- a revised architecture and implementation sequence.

No skill has been moved or renamed. No package or plugin manifest exists. No
package, release, marketplace submission, repository, commit, push, or pull
request was created.

## 3. Maintainer decisions

The following decisions are approved and should not be reopened without new
evidence.

### Repository and ownership

- Keep one public `Cratis/AI` repository.
- Do not create a second engineering repository now.
- Co-locate reusable Cratis engineering source under `engineering/`.
- Engineering source is public but excluded from every public product artifact.
- If a later split becomes necessary, prefer `Cratis/AI.Cratis` over
  `AI.Internal`.
- Do not rewrite public history.

### Public distribution

- Agent Plugins 1.x is the canonical public plugin format.
- Public skills live under root `skills/` after migration.
- Native wrappers expose the same public skills and MCP capabilities; they do
  not define independent behavior.
- Use a positive allowlist, never exclusion-based packaging.
- Do not add `install.sh`; prefer native installation and `gh skill install`.
- Use `cratis` as the public plugin and marketplace identifier.
- Use `@cratis/ai`, `@cratis/mcp`, and `@cratis/pi` as the proposed package
  names. Trusted publishing remains a release gate.
- Keep passive skills separate from executable MCP and Pi packages.

### Engineering distribution

- Broad repository-to-repository propagation is not the target architecture.
- Reusable engineering capabilities should be installed separately at user or
  organization scope through native host mechanisms.
- Shared content should eventually be removed from `.claude/`, `.agents/`, and
  Copilot-specific folders in consuming repositories.
- Those harness-specific locations must remain available for project-owned
  configuration.
- Do not force engineering rules, agents, prompts, or hooks through the portable
  Agent Plugin when a native host wrapper is required.
- Record capability differences honestly when a harness cannot support a given
  component type.

### Project-specific context

- `.cratis/PROJECT.md` is the target harness-neutral project context file.
- It owns project-specific build commands, profiles, endpoints, and credential
  handling guidance.
- It is never propagated from `Cratis/AI`.
- During migration, read `.cratis/PROJECT.md` first and fall back to
  `.agents/PROJECT.md`.
- When both exist, `.cratis/PROJECT.md` is authoritative.
- Never overwrite or silently merge project-owned content.
- Remove `.agents/PROJECT.md` only after all supported harnesses can discover
  the replacement through installed engineering guidance.

This implements the stated goal of emptying shared content from Claude,
`.agents`, and Copilot directories so those locations can become genuinely
project-dependent without losing multi-harness project context.

## 4. Skill decisions

### Classification

The current 43 source skills are classified as:

- 35 public source candidates;
- 8 Cratis engineering skills.

Engineering skills:

- `add-cratis-docs-page`;
- `edit-cratis-docs`;
- `qa-cratis-docs`;
- `write-documentation`;
- `ship-changes`;
- `skill-creator`;
- `add-traces`;
- `cratis-csharp-standards`.

`add-traces` is engineering-owned because it describes Chronicle kernel
repository and package maintenance. Broad C# conventions are engineering policy,
not an initial on-demand public product capability. Each public skill should
carry only the C# facts needed for its workflow.

### Approved target refinements

- Split `add-business-rule` into:
  - `cratis-arc-command-validation`;
  - `cratis-chronicle-event-constraints`.
- Use `cratis-arc-ef-core-migration`.
- Use `cratis-arc-command-execution`.
- Use `cratis-arc-authentication-authorization-and-identity`.
- Use `cratis-chronicle-cli-operations`.
- Use `cratis-arc-react-feature-scaffolding`.
- Use `cratis-application-slice-specifications`.
- Use `cratis-application-react-specifications`.

### Merge decisions

- Produce one reconciled `cratis-application-vertical-slice` draft.
- Keep the merge only if positive and negative trigger evaluations demonstrate
  useful routing.
- Do not concatenate the two legacy skill bodies or preserve stale references.
- Keep `review-performance` focused and separate for now.
- Remove duplicated and contradictory performance ownership from general code
  review before approving either review skill.

Splitting one source and merging the two vertical-slice sources results in a
projected 35 initial public skills.

### Skill quality requirements

Every migrated public skill must:

- have a narrow positive trigger;
- state near-miss exclusions where adjacent skills exist;
- use the final semantic name in its directory and frontmatter;
- be self-contained or use linked in-skill references;
- have no dependency on engineering rules, agents, prompts, hooks, or skills;
- contain no scripts or evals in its runtime directory;
- use current Cratis APIs and remove stale examples;
- resolve the behavioral conflicts recorded in the audit;
- have behavior evaluations;
- have positive and negative trigger evaluations;
- pass adjacent-skill collision tests before catalog approval.

A mechanical directory/frontmatter rename is not acceptable.

## 5. Known migration blockers

The complete evidence is in
`Documentation/skill-classification-audit.md`. Important blockers include:

- 19 public candidates depend on legacy rules or generated instructions;
- 11 currently public candidates contain colocated evals after the engineering
  reclassification;
- 24 public candidates lack equivalent current eval coverage;
- `event-modeling` invokes engineering-only `ship-changes`;
- several skills use repository-local or unresolved documentation links;
- stale React and vertical-slice references conflict with current guidance;
- reducer, paging, identity, event generation, validator I/O, command ID,
  cookie, barrel, and scenario-ownership guidance conflicts must be resolved;
- `skill-creator` contains the only skill scripts and an absolute workstation
  path; its complete Apache-2.0 bundle stays together under engineering.

## 6. Protected worktree state

At the beginning of the first implementation session, these pre-existing
changes existed and remain protected:

- `.ai/hooks/agent-stop.md`;
- `.ai/hooks/pre-commit.md`;
- `.ai/hooks/scripts/validate-ai-setup.sh`;
- `.gitignore`.

Their original aggregate diff was:

```text
4 files changed, 67 insertions(+), 23 deletions(-)
```

The next session must record a new baseline. It must not overwrite, revert,
stage, or absorb these changes.

Recommended treatment:

1. snapshot the protected changes;
2. classify them as reusable engineering behavior;
3. preserve their exact intent in the engineering ownership plan;
4. do not move or edit them in PR-2;
5. relocate them only in the later engineering source-move pull request;
6. retain the originals until replacement pilots verify equivalent behavior.

## 7. Verified ecosystem and npm facts

The dated source registry is `catalog/ecosystem-versions.json`.

Important facts:

- Agent Plugins specification: 1.0.0;
- Agent Skills naming and directory parity are strict public requirements;
- `gh skill` is preview functionality;
- local GitHub CLI 2.71.2 does not contain the `skill` command;
- Cursor consumes root Agent Plugins without changes;
- OpenAI/Codex, Claude, Gemini, Copilot, Pi, and Junie require the native or
  compatibility handling recorded in the main handover;
- Pi documentation was verified against installed version 0.84.2;
- Junie public third-party submission remains provisional;
- `@cratis/ai`, `@cratis/mcp`, and `@cratis/pi` are currently unpublished;
- existing `@cratis` packages establish active use of the Cratis npm scope;
- npm authentication and trusted-publisher permission were not verified;
- no package was claimed or published.

Re-verify version-sensitive facts before creating manifests or releasing. Do
not redo this research during PR-2 unless official sources have changed.

## 8. Immediate next scope: complete reevaluation

Do not implement PR-2 yet. First run the discovery and reevaluation defined in:

- [`AI-REPOSITORY-REDESIGN-REEVALUATION-PROMPT.md`](./AI-REPOSITORY-REDESIGN-REEVALUATION-PROMPT.md)

The reevaluation must discover related documents and historical decisions that
the current handovers may have missed. It must then test the complete repository
and proposed architecture against live official Agent Plugins, Agent Skills, MCP,
package, marketplace, and harness documentation.

The current maintainer decisions remain the baseline, but the reevaluation may
recommend changing one when new evidence demonstrates that it is incompatible,
unsafe, incomplete, or materially harder to maintain. Changes require explicit
evidence and a decision log.

PR-2 engineering ownership reduction resumes only after the reevaluation report
confirms or revises:

- repository and artifact boundaries;
- propagation replacement;
- project-context discovery;
- public and engineering skill classifications;
- Agent Plugin conformance;
- native harness distribution;
- catalogs, schemas, and validation strategy;
- implementation phases and pull-request sequence.

## 9. Reevaluation acceptance criteria

- Every related repository document and material historical decision is
  inventoried with authority and currentness.
- External facts are verified from live official sources with citations.
- Agent Plugin conformance is assessed against an actual materialized-artifact
  model, not inferred from the proposed directory tree.
- Every claimed harness has a capability and installation assessment.
- Co-location, repository splitting, no shared corpus, and native engineering
  distribution alternatives are compared rather than assumed.
- The goal of freeing harness-specific project directories is tested against
  real host capabilities.
- `.cratis/PROJECT.md` viability is verified or revised.
- Every current artifact and all 43 skills are reevaluated.
- Existing catalogs, schemas, validators, and phases are audited for false
  assurance and missing constraints.
- `AI-REPOSITORY-REDESIGN-REEVALUATION.md` records the verdict, evidence,
  changes, uncertainties, and revised next prompt.
- No source migration, manifest creation, publication, or destructive operation
  occurs.
- Protected work remains unchanged.

## 10. Exact prompt for the next session

Copy and execute the complete prompt in:

- [`AI-REPOSITORY-REDESIGN-REEVALUATION-PROMPT.md`](./AI-REPOSITORY-REDESIGN-REEVALUATION-PROMPT.md)

Do not combine it with the deferred PR-2 implementation prompt. The
reevaluation report must produce a new evidence-based implementation prompt.

## 11. Completeness note

This handover consolidates all decisions and evidence visible in the current
conversation and the prior-session conclusions preserved in the main handover.
If a separate earlier session contains decisions that were never added to the
main handover or supplied in this conversation, its transcript must be provided
before claiming those unseen decisions are incorporated.
