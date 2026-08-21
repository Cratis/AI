# Prompt — Cratis/AI Redesign Decision and Artifact-Boundary Foundation

> **Completed and superseded for execution.** Use
> [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md)
> for the full authorized program. Preserve this prompt as the foundation
> execution record.

Copy the prompt below into the next implementation session.

```text
Implement the next evidence-backed Cratis/AI redesign foundation. This prompt
supersedes the old PR-2 engineering-ownership prompt.

Do not move, rename, delete, publish, package, install, commit, push, or create a
pull request unless the maintainer separately asks. Do not create plugin.json,
package.json, native marketplace manifests, root skills/, public/, or
engineering/ source trees in this session.

## 1. Protect the worktree

Before reading or editing repository content, record fresh:

- git status and branch/upstream divergence;
- staged, unstaged, untracked, and ignored names;
- diff summaries;
- hashes of all pre-existing changed files.

Treat every pre-existing change as protected. Never overwrite, revert, stage,
clean, or absorb it. In particular, do not edit:

- .ai/hooks/agent-stop.md;
- .ai/hooks/pre-commit.md;
- .ai/hooks/scripts/validate-ai-setup.sh;
- .gitignore;
- Documentation/index.md.

Do not clean .pi/tasks, .pi/delegate, .pi/fusion, caches, or generated reports.

## 2. Read the canonical record completely

Read, in order:

1. AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md;
2. AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md;
3. AI-REPOSITORY-REDESIGN-REEVALUATION.md;
4. this prompt;
5. AI-REPOSITORY-REDESIGN-HANDOVER.md as superseded decision history;
6. AI-REPOSITORY-REDESIGN-NEXT-SESSION-HANDOVER.md as superseded continuation;
7. Documentation/public-product-architecture.md;
8. Documentation/skill-classification-audit.md;
9. catalog/public-skills.yml;
10. catalog/product-coverage.yml;
11. catalog/ecosystem-versions.json;
12. all catalog schemas and tooling/catalog-validation.mjs plus its specs.

Also re-read the current bodies and comments of:

- https://github.com/Cratis/.github/issues/24;
- https://github.com/Cratis/Workflows/issues/68;
- https://github.com/Cratis/AI/issues/126;
- https://github.com/Cratis/AI/issues/127.

Use read-only authenticated GitHub access. Treat accepted organization records
as higher authority than untracked handovers.

## 3. Establish the distribution decision state

Before implementation, determine whether maintainers have accepted one of:

A. one canonical source repository plus a generated public-only release
   tree/ref/archive;
B. separate public product and engineering repositories;
C. another replacement that satisfies the reevaluation acceptance criteria.

Record the accepted decision or explicitly record that Workflows#68 remains
unresolved. Do not infer acceptance from this prompt.

If unresolved, implementation may still complete catalog/schema v2, the
ownership inventory, and fixture-only artifact materializer tests, but must not
create target source trees, manifests, install instructions, release refs, or
propagation changes.

Any accepted distribution must satisfy:

- mixed source is never the installable public artifact;
- gh skill publish/install --all runs only against a public-only materialized
  tree;
- no engineering Agent Skill source lives in a recursively discoverable
  **/skills path;
- every runtime file comes from an exact positive selection;
- release artifacts contain no symlinks, path escapes, special files, scripts,
  evals, engineering content, or local configuration;
- native wrappers expose exactly the same public skills and MCP behavior;
- update, pin, rollback, canary, and emergency-disable ownership belongs to
  Cratis/Workflows;
- unsupported native component parity is documented honestly.

## 4. Implement catalog/schema v2

Replace the source-oriented public catalog model with four explicit concepts:

1. sources — all current skill inputs and ownership;
2. targets — independently approvable public or engineering outputs;
3. migrations — retain, rename, split, merge, or retire edges;
4. artifacts — exact runtime artifact definitions and component inventories.

Do not rename current files merely for aesthetics. A staged schema migration is
acceptable if it preserves v1 input long enough to prove equivalent inventory.

Every public target must include:

- stable target id and semantic name;
- all source skill ids;
- owner and audience;
- products and languages;
- one capability and positive trigger intent;
- near-miss exclusions and collision set;
- internal and external dependencies;
- runtime payload policy;
- executable/destructive/security risk classification;
- behavior-eval status;
- positive-trigger, negative-trigger, and collision-eval status;
- approval state;
- evidence ids;
- reviewer and approval date when approved;
- approved source revision and content digest;
- includeInRuntime, which can be true only for a fully approved target.

A split creates two independent target records. A merge creates one target that
names every input and records merge-evaluation evidence. Source entries are
never treated as publication approvals.

Every product/support claim and ecosystem fact must reference evidence ids
directly. Separate roadmap coverage from released support:

- coverageState: gap | source-candidate | partial | complete;
- claimState: unclaimed | verified | deprecated.

Evidence records must include official URL, source kind, verification date,
applicable version, confidence, and immutable revision/digest when available.

Preserve deny-by-default semantics and complete accounting for all 43 current
skills and all current non-skill artifact categories.

## 5. Complete the artifact ownership inventory

Create a schema-backed repository inventory that accounts for every current:

- rule;
- agent;
- prompt/command;
- hook guidance, script, config, and host bridge;
- workflow and propagation/synchronization script;
- adapter, symlink, and path-reference file;
- skill and bundled resource;
- evaluation;
- documentation page;
- Pi extension;
- generated or derived surface.

Each record needs source path, artifact type, current owner, target owner,
runtime eligibility, generated/adapter status, dependencies, risk, migration
state, and evidence. Group records only when the group is mechanically expanded
and the validator proves every current path is accounted for.

Use these owners only:

- public Cratis product capability;
- reusable Cratis engineering behavior;
- project-owned context/bootstrap;
- Stagehand;
- Ensemble;
- Workflows organization mechanics;
- repository-only authoring/release tooling;
- obsolete, with deletion deferred until replacement evidence exists.

Do not move any source in this session.

## 6. Build a fixture-only public artifact materializer foundation

Implement the materializer and tests against sanitized test fixtures, not the
live skill tree and not a real plugin manifest.

The materializer must:

1. create a new empty staging directory;
2. select only exact catalog-approved source files;
3. use lstat and realpath containment checks;
4. reject all symlinks, junction-equivalents, special files, path traversal,
   absolute paths, hidden local state, and duplicate archive paths;
5. reject scripts, evals, rules, agents, prompts, commands, hooks, LSP,
   engineering content, tooling, workflows, caches, and private/local data;
6. permit only SKILL.md, linked references/assets, required licenses, and
   explicitly approved public metadata;
7. emit a sorted exact-path manifest with SHA-256 for every file;
8. verify every reference remains inside its skill and resolves;
9. validate the staged tree rather than the working tree;
10. pack and unpack a fixture archive safely, then repeat validation;
11. prove recursively discoverable skill paths contain only public targets;
12. fail if an engineering/skills-style fixture could be discovered by --all.

Do not call gh skill publish locally unless the installed gh actually supports
it. Do not install a newer gh or skills-ref merely for this task.

## 7. Correct documentation and decision authority

Update the architecture and continuation handovers with an additive decision
log. Do not silently rewrite historical claims.

Required corrections:

- this reevaluation report is the canonical continuation entry;
- Workflows#68 owns the unresolved/accepted distribution decision;
- direct installation from mixed source is unsupported;
- .cratis/PROJECT.md is canonical content but not automatically discovered;
- recognized project-owned bootstraps or managed config are required;
- native engineering parity is impossible and documented per host;
- propagation retirement remains gated by application and framework pilots;
- the approved historical one-off rewrite is acknowledged, while further
  history rewriting remains prohibited;
- the current ecosystem registry, not old prose lists, owns version-sensitive
  facts.

Do not edit the protected Documentation/index.md change. If navigation needs a
new entry, report it as protected follow-up rather than overwriting it.

## 8. Project-context design

Specify and fixture-test the smallest project-owned fallback:

- root AGENTS.md for Copilot, Codex, Cursor, OpenCode, and Pi;
- root CLAUDE.md importing .cratis/PROJECT.md for Claude;
- root GEMINI.md importing .cratis/PROJECT.md for Gemini;
- explicit user/managed configuration may remove a bootstrap only where an
  official host mechanism proves equivalent discovery.

The bootstrap fixtures must be minimal and must never contain shared corpus
content. Migration reads .cratis/PROJECT.md first and legacy
.agents/PROJECT.md only as fallback. Never overwrite or combine project-owned
content automatically.

Do not deploy these files to consuming repositories in this session.

## 9. Required tests and validation

Run before and after edits:

- .ai/hooks/scripts/validate-ai-setup.sh;
- node tooling/validate-catalogs.mjs;
- node --test tooling/specs/catalog-validation.spec.mjs;
- strict JSON parsing for every catalog/schema;
- all new schema, ownership-inventory, and materializer specs;
- LSP diagnostics for every changed .mjs/.js/.ts file;
- scoped Markdown lint and link checks for changed documents;
- lens_diagnostics mode=all for every changed file;
- git diff --check;
- fresh git status and protected-file hash comparison.

Treat warnings as errors for new tooling. Record the three known legacy corpus
warnings separately if they remain unchanged.

Do not install or authenticate paid clients. Record unavailable validators and
local version limitations. No green catalog check may be described as plugin or
release conformance.

## 10. Deliverables

Produce:

1. catalog/schema v2 and migration/equivalence tests;
2. complete schema-backed artifact ownership inventory;
3. fixture-only exact-allowlist materializer and adversarial specs;
4. project-context bootstrap specification and fixtures;
5. additive architecture/decision-log updates;
6. a validation record with exact commands, outcomes, limitations, and protected
   hash comparison;
7. an updated continuation handover and implementation plan reflecting evidence
   discovered during the session;
8. a precise next prompt for the first approved source-move session.

Apply the stop conditions and PR boundaries from
AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md. Prefer a smaller, fully verified
foundation over partially implementing a later phase.

Stop before source moves, manifests, packaging, publication, propagation
changes, commits, pushes, or pull requests.
```
