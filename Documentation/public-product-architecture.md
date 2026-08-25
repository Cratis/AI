# Public Product and Internal Engineering Ownership

> **Reevaluation update — 2026-08-20:** The ownership separation remains sound, but direct distribution from a co-located source checkout is rejected. `Cratis/Workflows#68` still owns the replacement distribution decision. Public releases must be materialized into a public-only tree, engineering Agent Skills must not live under a recursively discoverable `**/skills` source path, and `.cratis/PROJECT.md` requires project-owned host bootstraps or managed configuration. See [`../AI-REPOSITORY-REDESIGN-REEVALUATION.md`](../AI-REPOSITORY-REDESIGN-REEVALUATION.md).

**Decision status:** Maintainer direction recorded
**Scope:** Public product and Cratis engineering source boundaries
**Recorded:** 2026-08-20

This decision establishes the product boundary for the Cratis AI redesign. It
supersedes the legacy `.ai/` propagation architecture where the two conflict.
It does not move or remove legacy content in this pull request.

## Context

`Cratis/AI` currently authors rules, agents, prompts, hooks, skills, and
propagation adapters together. Those artifacts serve internal Cratis
engineering. The redesigned public product instead serves developers who need
portable Cratis capabilities in their own AI harness.

Publishing the current tree would expose operational behavior and create
accidental runtime dependencies on repository-specific instructions. The
redesign therefore separates ownership by audience and capability.

## Decision

`Cratis/AI` will be the public source for two separately distributed concerns:

- portable public Agent Skills and optional MCP capabilities;
- reusable Cratis engineering rules, agents, prompts, hooks, and operational
  skills under `engineering/`.

The repository also owns thin native wrappers and repository-only validation,
evaluation, generation, and release tooling. None of that tooling enters a
runtime artifact.

The canonical public plugin format will be Agent Plugins 1.x. Native wrappers
must not define separate behavior.

The public product will use root `skills/` after migration. Current
`.ai/skills/` paths remain legacy sources during the catalog-only first pull
request.

## Ownership boundary

The public product artifact owns portable Cratis product and workflow skills,
their approved static references and assets, and optional portable MCP
descriptors. It must never contain engineering rules, agents, prompts, hooks,
LSP servers, operational skills, or project facts.

The same public repository may contain those sources under a hard boundary:

- `skills/` owns public product capabilities;
- `engineering/` owns reusable Cratis engineering behavior;
- `.cratis/PROJECT.md` in consuming repositories owns project facts;
- `Cratis/Stagehand` owns control-plane behavior;
- `Cratis/Ensemble` owns software-factory investigation behavior;
- obsolete adapters and propagation machinery have no long-term owner.

"Engineering" describes the Cratis audience, not confidentiality. No second
repository is currently needed. If a later split becomes necessary,
`Cratis/AI.Cratis` is the preferred fallback name.

Every artifact must have exactly one owner. The legacy `.ai` tree must not be
copied wholesale into `engineering/` merely to preserve it.

## Deny-by-default catalog

`catalog/public-skills.yml` is the only public-skill allowlist. Its semantics
are:

1. `defaultPolicy` is `deny`.
2. A current skill appearing as a candidate does not authorize publication.
3. Only an entry with `publicationStatus: approved` and
   `includeInRuntime: true` may enter a future runtime artifact.
4. Approval requires the canonical source `skills/<public-name>`, name and
   directory parity, no internal dependencies, and no open review notes.
5. Duplicate proposed names are invalid except for one explicit shared
   `merge-review` group.
6. Internal skills are recorded only for inventory accounting. They are not
   allowlist entries.
7. Packaging must select approved entries. It must never package the working
   tree and subtract forbidden paths.

The maintainer decision classifies 35 current skills as public source
candidates and eight as engineering skills. Splitting the broad business-rule
skill and merging the competing vertical-slice pair would yield 35 initial
public skills if evaluations approve both changes. No skill is runtime-approved
yet.

The public runtime payload policy allows only:

- `SKILL.md`;
- linked, non-executable `references/**`;
- approved, non-executable `assets/**`;
- required license or attribution files.

It forbids rules, instructions, agents, prompts, commands, hooks, LSP
definitions, scripts, evals, tooling, and `.ai/**`.

## Catalog and schema design

The first pull request introduces three versioned catalogs and matching JSON
Schemas:

- `catalog/public-skills.yml` maps current skills to proposed public skills and
  is the runtime allowlist. A candidate is not an approval.
- `catalog/product-coverage.yml` records the product, capability, and language
  roadmap. A backlog entry is not a support claim.
- `catalog/ecosystem-versions.json` records version-sensitive ecosystem facts
  and official sources. Every fact has a dated source.

The `.yml` catalogs intentionally use JSON-compatible YAML syntax in this
dependency-free scaffold. `tooling/catalog-validation.mjs` parses that
constrained representation without introducing a package manifest. Later
tooling may adopt a full YAML dependency without changing catalog semantics.

Each schema rejects unknown properties. Semantic validation then checks
cross-file rules that JSON Schema alone does not express. These checks include
complete skill inventory accounting, source `SKILL.md` name parity, product
and language references, merge-group uniqueness, approval safety, and required
ecosystem records.

## Product and language claims

`catalog/product-coverage.yml` separates four states:

- `candidate`: a current public candidate addresses the capability;
- `partial`: guidance exists but does not own the complete capability cleanly;
- `backlog`: no current public candidate covers the desired capability;
- `verification-required`: no support claim is allowed until the product or
  client and its supported version are verified.

Language-specific skills are justified only when setup, APIs, error handling,
or build and test workflows differ materially. Product names in prose do not
establish support.

## Ecosystem source policy

`catalog/ecosystem-versions.json` records only official specifications,
official documentation, official repositories, registry responses, and
installed version-pinned Pi documentation. Each record has a verification date
and explicit facts.

This registry is evidence, not a compatibility promise. Actual release support
still requires installation smoke tests against the client versions selected
for that release.

## Grok and DeepSeek adapters

Grok Build is an xAI coding-agent harness with native project `.grok/skills`
and user `~/.grok/skills` discovery. The generator currently emits only the
Claude-compatible marketplace and plugin under `grok/`, which Grok can consume
through its documented Claude Code compatibility. A native `grok/.grok/skills/`
projection is planned but is not emitted today.

DeepSeek has two distinct roles. DeepSeek Harness is an official developer-
preview agent harness and receives direct, non-recursive
`deepseek/.dsh/skills/<skill-name>/SKILL.md` bundles. DeepSeek models are also
providers inside other harnesses such as Pi, Claude Code, and GitHub Copilot;
those use the existing harness package rather than receiving duplicated skill
bytes under a model-specific package. DeepSeek Harness compatibility must be
reverified while its upstream contract remains in developer preview.

## Executable capability boundary

Passive skills and executable capabilities remain separate:

- future `@cratis/ai`: passive public skills and manifests;
- future `@cratis/mcp`: executable MCP server, after tool-surface approval;
- future `@cratis/pi`: Pi-native executable extensions, only when they provide
  genuine Pi-specific value.

No package or plugin manifest is created by this decision. MCP and Pi code
require separate security review because they execute with host permissions.

## Consequences

Positive consequences:

- public runtime contents become auditable and reproducible;
- internal behavior cannot enter a package merely because it exists here;
- ecosystem wrappers stay behaviorally aligned;
- capability and language gaps are visible without overstating support;
- external assumptions have dated sources and can be monitored for drift.

Costs and follow-up work:

- every candidate must become self-contained before approval;
- public-to-engineering links must be removed or replaced with public facts;
- trigger evaluations are required before semantic splits, renames, and merges;
- native engineering installation differs by harness capability;
- package, plugin, CI, and marketplace work remains deferred.

## Propagation replacement

Broad repository-to-repository propagation is not the target. Public skills
should be installed through public native channels. Reusable engineering
behavior should be installed separately at user or organization scope.

This allows `.claude/`, `.agents/`, and Copilot-specific folders in consuming
repositories to contain project-owned configuration rather than synchronized
shared files.

`.cratis/PROJECT.md` becomes the harness-neutral project context. Migration
must read it before the legacy `.agents/PROJECT.md`, preserve both without data
loss, and remove the legacy file only after supported harnesses can discover
the new location.

## Recorded decisions

- Keep one public `Cratis/AI` source repository.
- Keep engineering source co-located but outside every public artifact.
- Move `add-traces` and broad C# conventions to engineering ownership.
- Use `cratis` as the public plugin and marketplace identifier.
- Use the proposed `@cratis/ai`, `@cratis/mcp`, and `@cratis/pi` names.
- Do not rewrite public history.
- Use a gated vertical-slice merge.
- Keep focused performance review after correcting duplicated guidance.

Exact Stagehand and Ensemble file ownership will be resolved by the complete
artifact classification rather than guessed in advance. Trusted-publisher
access remains a release gate.

## Foundation decision log — 2026-08-20

The decision and artifact-boundary foundation records these additive
corrections. They supersede implementation assumptions above without erasing
the historical proposal:

- `Cratis/Workflows#68` remains open. No distribution architecture has been
  accepted, so no source tree, manifest, package, install instruction, release
  ref, publication, or propagation change is authorized.
- Direct installation from the mixed source branch is unsupported. A future
  accepted release must materialize exact approved files into a new public-only
  tree.
- The v1 catalogs remain readable audit scaffolding. Catalog v2 separates 43
  source records, independently approvable targets, migration edges, artifact
  definitions, evidence-bound facts, released claims, and repository ownership.
- Engineering Agent Skill source must not use a recursively discoverable
  `**/skills` path. The adversarial fixture proves why `engineering/skills/`
  cannot be a public-source layout.
- `.cratis/PROJECT.md` is canonical project-owned content, not an automatically
  discovered host convention. Minimal project-owned bootstraps or proven
  managed configuration are required as specified in
  [`project-context-bootstrap.md`](./project-context-bootstrap.md).
- Native engineering parity is impossible. Each future host package must state
  its actual instruction, agent, prompt, hook, MCP, LSP, installation, and trust
  capabilities.
- Application and framework pilots remain mandatory before propagation or
  adapter retirement. Workflows owns canary, pinning, rollback, emergency
  disable, and fleet evidence.
- The approved historical one-off purge remains acknowledged by `Cratis/AI#127`.
  Further history rewriting remains prohibited.
- `catalog/ecosystem-versions.json` and its evidence-bound v2 projection own
  version-sensitive facts. Older prose client lists are historical only.

The schema-backed repository inventory and fixture-only materializer create no
runtime approval. A green catalog or fixture test is not plugin, package,
marketplace, installation, or release conformance.

## Autonomous Option A+ acceptance — 2026-08-20

The distribution decision previously left open in this document is now
accepted and recorded in
[`Cratis/Workflows#68`](https://github.com/Cratis/Workflows/issues/68#issuecomment-5363284054)
and the parent
[organization epic](https://github.com/Cratis/.github/issues/24#issuecomment-5363284173).

The accepted architecture is Option A+:

- this repository remains the canonical authoring, composition, approval,
  evaluation, and generation source;
- a dedicated automation-managed public distribution repository contains only
  generated approved content;
- the mixed source repository is never a supported installation target;
- the distribution repository is bot-owned, protected, and not manually
  authored;
- tags, archives, passive packages, native wrappers, and marketplace submissions
  derive from one staged logical tree;
- Workflows owns promotion, canaries, pins, rollback, emergency disable, and
  propagation retirement.

This acceptance supersedes the earlier unresolved-decision statements, but it
does not approve a target, materialization, package, release, or marketplace
submission. Those remain gated by exact source contracts, evaluations, target
approval, artifact validation, provenance, and rollout evidence.
