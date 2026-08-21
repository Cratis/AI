# Prompt — Complete Cratis/AI Discovery and Ecosystem Reevaluation

Copy the prompt below into a fresh implementation session.

```text
Perform a complete, evidence-driven reevaluation of the Cratis/AI repository
before any further redesign implementation.

This is a research, audit, and architecture-validation session. It supersedes
PR-2 implementation as the immediate next task. Do not move, rename, delete,
publish, package, install, commit, push, or create a pull request.

## 1. Protect the worktree first

Before reading or changing repository content:

1. Record fresh `git status`, branch/upstream, staged names, unstaged names,
   untracked names, and diff summaries.
2. Treat every pre-existing change as protected.
3. In particular, do not overwrite, revert, stage, or absorb:
   - `.ai/hooks/agent-stop.md`
   - `.ai/hooks/pre-commit.md`
   - `.ai/hooks/scripts/validate-ai-setup.sh`
   - `.gitignore`
4. Record any additional protected changes discovered at session start.
5. Do not clean ignored files or rewrite history.

## 2. Read the known record completely

Read these files completely before drawing conclusions:

1. `AI-REPOSITORY-REDESIGN-HANDOVER.md`
2. `AI-REPOSITORY-REDESIGN-NEXT-SESSION-HANDOVER.md`
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

Treat the handovers as hypotheses and recorded decisions, not proof that every
relevant source was found or that the proposed architecture is correct.

## 3. Discover every related repository document and decision source

Perform a fresh repository-wide discovery. Do not limit the search to the known
files above.

Inventory and review all files that may describe or implement:

- AI repository purpose or architecture;
- public versus Cratis-engineering ownership;
- Agent Skills, Agent Plugins, MCP, packages, extensions, or marketplaces;
- rules, persistent instructions, agents, prompts/commands, hooks, or LSP;
- adapters, symlinks, path-reference files, generated files, or propagation;
- installation, bootstrap, synchronization, or repository initialization;
- `.agents/PROJECT.md`, project-specific context, or multi-harness behavior;
- Stagehand, Ensemble, Planner, Factory, or orchestration ownership;
- skill creation, evaluation, trigger testing, or packaging;
- release, npm, GitHub Actions, trusted publishing, or marketplace submission;
- prior redesigns, ADRs, handovers, experiments, TODOs, issues, or deprecations.

Search at minimum:

- all root files, including hidden files;
- `.ai/**`;
- `.agents/**`, `.claude/**`, `.github/**`, `.pi/**` source configuration;
- `Documentation/**`;
- workflows and scripts;
- manifests, schemas, catalogs, and lock/config files;
- tracked symlinks and path-reference adapters;
- repository-local task/evaluation definitions that are not runtime sources.

Use read-only Git history to find relevant documents or decisions that were
renamed, deleted, superseded, or never incorporated into the handovers. Inspect
commit messages and file history where they materially affect architecture.
Do not restore deleted files merely because they existed.

If locally available, inspect relevant architecture/ownership documents in
sibling Cratis repositories such as Stagehand, Ensemble, and Documentation.
Use them only as evidence for ownership boundaries. Do not modify sibling
repositories.

If GitHub issues, pull requests, or discussions for Cratis/AI contain relevant
maintainer decisions and are accessible through authenticated read-only tools,
include them. Distinguish accepted decisions from proposals and abandoned
experiments.

Do not treat `.pi/tasks`, Fusion output, caches, generated reports, or chat
artifacts as authoritative repository policy. They may be used only to locate a
claim that is then verified against source, history, maintainer decisions, or
official documentation.

Produce a source inventory containing:

- path or URL;
- document purpose;
- authority level;
- current, superseded, conflicting, or unknown status;
- decisions/facts contributed;
- conflicts with the current handover;
- recommended disposition.

## 4. Re-verify all external ecosystems from official sources

Current ecosystem facts are version-sensitive. Search the live web first and
fetch authoritative sources. Do not answer from model memory, search-result
snippets, third-party blogs, or package internals.

Re-verify at minimum:

### Portable standards

- Agent Plugins specification, schema, compatible clients, component discovery,
  extension fields, path containment, symlink behavior, failure isolation, MCP
  transports, and versioning;
- Agent Skills specification, frontmatter, naming/directory parity, resource
  rules, link/path requirements, compatibility, and validation;
- Model Context Protocol and registry requirements relevant to future Cratis
  servers.

### Distribution and harnesses

- GitHub CLI `gh skill`, including preview status, discovery, install targets,
  scopes, publishing, releases, and current supported agent identifiers;
- GitHub Copilot plugins and marketplaces;
- OpenAI ChatGPT/Codex plugins, local marketplaces, public submission, skills,
  MCP, hooks, and Agent Plugin compatibility;
- Claude Code plugins and marketplaces;
- Gemini CLI extensions, skills, MCP, release archives, and gallery discovery;
- Cursor Agent Plugins, Cursor-native plugins, and marketplace submission;
- Pi packages, skills, and extensions, using installed version-pinned docs plus
  current official package information;
- Junie/JetBrains extension structure and actual third-party distribution
  support;
- every client currently listed by the Agent Plugins compatible-client registry;
- direct Agent Skills targets relevant to Cratis, including OpenCode and any
  other Tier 2 target still claimed by the handover.

### Supply chain

- npm organization-scope behavior;
- availability of `@cratis/ai`, `@cratis/mcp`, and `@cratis/pi`;
- trusted publishing, provenance, supported Node/npm requirements, and
  organization permission requirements;
- GitHub release, immutable source, checksum, and marketplace expectations.

For every ecosystem record, capture:

- official source URL;
- verification date;
- current schema/spec/client version when published;
- canonical manifest and component paths;
- supported component types;
- installation scopes and update behavior;
- validation commands that actually exist;
- marketplace/publication mechanism;
- security and trust implications;
- what can be automated without paid interactive authentication;
- confidence and any unresolved ambiguity.

Update `catalog/ecosystem-versions.json` only when official evidence changes or
materially refines an existing fact. Do not edit the architectural handovers
until the full reevaluation is synthesized.

## 5. Test the Agent Plugin architecture rigorously

Evaluate the proposed public product as if preparing an actual release artifact.
Do not create manifests yet.

Determine whether the proposed structure can conform to the current Agent
Plugins specification and each claimed client. Explicitly assess:

- whether root `plugin.json`, root `skills/`, and optional `mcp.json` are still
  correct;
- closed-schema and unknown-field behavior;
- whether a source repository may safely contain `engineering/`, tooling,
  evals, workflows, and native wrappers while the materialized public plugin
  artifact excludes them;
- whether direct repository installation would accidentally expose or process
  non-public source content;
- whether release archives and npm tarballs can be built from a strict positive
  allowlist;
- path traversal, escaping symlinks, hidden paths, generated files, and archive
  root requirements;
- whether native wrappers truly expose the same public skills/MCP behavior;
- which wrappers require extra client-specific metadata without changing
  behavior;
- version parity and immutable marketplace source requirements;
- whether `@cratis/ai` can be both a passive npm/Pi package and a canonical
  Agent Plugin without confusing installation semantics;
- whether future MCP and Pi executable packages remain meaningfully separated
  from passive skills.

Produce explicit conformant/nonconformant/unknown findings, with exact evidence.
Do not mark the architecture conformant merely because schemas could be written.

## 6. Reevaluate the engineering-corpus and propagation decision

Do not assume co-location or removal of propagation is correct. Compare at least
these alternatives:

1. one public repository with co-located `engineering/` and strict artifact
   boundaries;
2. separate public repositories for product and Cratis engineering source;
3. no shared engineering corpus: public skills plus project-local context and
   Stagehand/Ensemble ownership;
4. a minimal co-located engineering source distributed through native
   user/organization packages, with no repository propagation;
5. any better evidence-backed alternative discovered during research.

Score each alternative for:

- compatibility across supported harnesses;
- ability to free `.claude/`, `.agents/`, and Copilot directories for
  project-owned configuration;
- discoverability of project-specific context;
- correctness of the proposed `.cratis/PROJECT.md` convention;
- need for a bootstrap file in harnesses that cannot load installed persistent
  guidance;
- update and rollback behavior;
- risk of internal/engineering content leaking into public artifacts;
- maintenance burden and source drift;
- offline and CI behavior;
- security/trust implications of hooks and executable extensions;
- onboarding and installation UX;
- interaction with Stagehand and Ensemble;
- whether broad propagation is still necessary for any component.

Build a harness capability matrix for:

- skills;
- persistent instructions/rules;
- custom agents;
- prompts/commands;
- hooks;
- MCP;
- LSP;
- user scope;
- organization/managed scope;
- project scope;
- update mechanism;
- project-context discovery.

Do not assume one native package can provide unsupported component types. State
where parity is impossible and what the smallest safe fallback is.

Specifically test the goal expressed by the maintainer:

- shared content should leave `.claude/`, `.agents/`, and Copilot folders;
- those locations should become project-dependent;
- project-specific `.agents/PROJECT.md` behavior must survive in a genuine
  multi-harness model.

Conclude whether `.cratis/PROJECT.md` is the right convention, needs a different
name/location, or requires a generated/minimal bootstrap. Support the conclusion
with harness evidence rather than preference.

## 7. Reaudit the complete repository and all skills

Reaudit the current repository, not only the proposed target.

### Artifact audit

Account for every current:

- rule;
- agent;
- prompt/command;
- hook;
- workflow;
- adapter;
- path-reference file and symlink;
- skill and bundled resource;
- evaluation;
- documentation page;
- propagation or initialization script;
- generated or derived surface.

Identify duplicate authority, stale content, hidden dependencies, broken links,
public-to-engineering references, project-local assumptions, generated-file
risks, and anything that cannot fit the proposed ownership model.

### Skill audit

Reaudit all 43 current skills against the live Agent Skills specification and
the intended Cratis product boundary. For every skill determine:

- public product, Cratis engineering, project-specific, other product owner, or
  obsolete;
- one capability and one intended trigger;
- positive trigger wording;
- near-miss exclusions;
- competing skills and collision risk;
- semantic public name;
- split, merge, retain, or retire decision;
- internal/rule/agent/prompt/hook dependency;
- stale or contradictory API guidance;
- bundled scripts/evals/assets/licenses;
- behavior eval coverage;
- positive and negative trigger coverage;
- security and destructive-operation risk;
- exact remediation required before approval.

Reevaluate, rather than merely repeat, the current decisions to:

- move `add-traces` and broad C# conventions to engineering ownership;
- split `add-business-rule`;
- merge the vertical-slice pair conditionally;
- keep focused performance review;
- use the refined semantic names.

Preserve an approved decision when evidence still supports it. Change it only
with explicit evidence and explain the consequence for counts, references,
evals, and migration order.

## 8. Validate catalogs, schemas, and implementation plan

Review the PR-1 scaffolding itself:

- `catalog/public-skills.yml`;
- `catalog/product-coverage.yml`;
- `catalog/ecosystem-versions.json`;
- all three schemas;
- catalog validation implementation;
- catalog specs;
- architecture documentation;
- phase sequencing and pull-request boundaries.

Check for:

- deny-by-default semantics;
- closed schemas;
- complete inventory accounting;
- split/merge modeling correctness;
- unsupported or misleading product/language claims;
- insufficient approval states;
- missing security metadata;
- missing provenance/source fields;
- assumptions that will not scale to generated manifests or artifact packaging;
- validation gaps and false assurances;
- whether JSON-compatible YAML remains justified.

Run existing checks before and after any permitted documentation/catalog update.
Treat warnings as errors, but distinguish pre-existing legacy warnings from new
regressions.

## 9. Required deliverables

Create `AI-REPOSITORY-REDESIGN-REEVALUATION.md` containing:

1. executive verdict: sound, sound with changes, or redesign required;
2. complete related-document/source inventory;
3. conflicts, superseded documents, and missing prior decisions;
4. official-source ecosystem findings with citations;
5. Agent Plugin specification conformance assessment;
6. per-harness capability and installation matrix;
7. current-repository artifact ownership audit;
8. complete 43-skill reevaluation;
9. public artifact and supply-chain threat review;
10. engineering corpus/propagation alternatives and recommendation;
11. `.cratis/PROJECT.md` viability conclusion;
12. catalog/schema/validator assessment;
13. decisions that remain valid, decisions that should change, and why;
14. revised target tree and artifact boundaries;
15. revised phased implementation plan and pull-request sequence;
16. exact validation evidence and anything not verified;
17. one precise prompt for the next implementation session.

Also produce a compact machine-readable evidence inventory under `catalog/`
only if it has a clear schema and validation. Do not create it merely to satisfy
a checklist.

After the report is complete:

- update `catalog/ecosystem-versions.json` for verified fact changes;
- update the architecture handover, continuation handover, catalogs, and
  documentation only where the report establishes an evidence-backed change;
- keep a clear decision log rather than silently rewriting old conclusions;
- make the new reevaluation report and its final implementation prompt the
  canonical continuation entry point.

## 10. Validation

Run at minimum:

- the existing AI corpus validator;
- public catalog validation and specs;
- scoped Markdown lint and link validation for all changed reports/docs;
- schema and JSON/YAML parsing checks;
- LSP diagnostics for changed tooling;
- session diagnostics for every changed file;
- `git diff --check`;
- read-only schema/client validators that are locally available;
- `gh skill publish --dry-run` only if the installed GitHub CLI actually
  supports it.

Do not install or authenticate paid clients merely to obtain a green result.
Record unavailable validators and authentication limitations explicitly.

## 11. Constraints

- Preserve American English.
- Never edit generated files.
- Do not infer Cratis behavior from package internals.
- Do not expose secrets, credentials, private URLs, or repository-local user
  data in research artifacts.
- Do not modify dependency manifests, lockfiles, or global tool configuration.
- Do not create plugin/package manifests during this reevaluation.
- Do not move or rename skills or engineering content.
- Do not delete adapters, propagation workflows, rules, agents, prompts, hooks,
  or evaluations.
- Do not create another repository.
- Do not rewrite history.
- Do not claim, publish, release, submit marketplaces, commit, push, or open a
  pull request unless explicitly asked.
- Report evidence and uncertainty; do not force the current architecture to
  pass.

Before editing any report, summarize the discovery plan and identify only
questions that genuinely block a read-only reevaluation. Otherwise proceed
autonomously through the full audit.
```
