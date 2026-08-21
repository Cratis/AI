# Cratis/AI — Public Skills, Agent Plugins, MCP, and Ecosystem Distribution Handover

> **Superseded for implementation on 2026-08-20.** The complete reevaluation found that the distribution decision is still owned by `Cratis/Workflows#68`, a mixed source checkout cannot be the public artifact, and `.cratis/PROJECT.md` requires host-recognized bootstraps or configuration. Preserve this document as proposal and decision history. Continue from [`AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md`](./AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md), [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md), and [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md).

**Research verified:** 2026-08-20
**Purpose:** implementation handover for turning `Cratis/AI` into the public, ecosystem-native distribution point for Cratis capabilities while co-locating separately distributed Cratis engineering configuration.
**Status:** maintainer direction recorded; implementation remains phased and decision-gated by validation evidence. This document does not itself execute the migration.

> Re-verify every external schema, CLI command, marketplace policy, and publishing requirement immediately before implementing or releasing. These ecosystems change quickly.

## Maintainer decision update — 2026-08-20

This update is authoritative where it conflicts with the original proposal below.

- Keep one public `Cratis/AI` repository. Do **not** create a second engineering repository now.
- Co-locate reusable Cratis engineering configuration under `engineering/`. It is public source for the Cratis engineering audience, but it is never part of the public `@cratis/ai` or Agent Plugin runtime artifact.
- If confidentiality or independent ownership later requires a split, prefer `Cratis/AI.Cratis` over `AI.Internal`; no split is currently approved.
- Stop treating propagation as the target distribution model. Shared capabilities should be installed through native packages/plugins at user or organization scope. Broad copying into every repository is retired after pilots prove the replacement.
- Free `.claude/`, `.agents/`, and Copilot-specific folders in consuming repositories for project-owned configuration. Shared corpus content must not occupy them through propagation.
- Replace project-specific `.agents/PROJECT.md` with the harness-neutral `.cratis/PROJECT.md`. During migration, loaders may read both, with `.cratis/PROJECT.md` authoritative. Never overwrite project-specific content.
- Classify `add-traces` and `cratis-csharp-standards` as Cratis engineering skills, not initial public product skills.
- Approve `cratis` as the public plugin/marketplace identifier and approve the proposed npm names `@cratis/ai`, `@cratis/mcp`, and `@cratis/pi`, subject to trusted-publisher setup before release.
- Do not rewrite public history.
- Merge the two vertical-slice skills only through a reconciled draft that passes positive and negative trigger evaluations.
- Keep a focused performance-review skill for now, but remove duplicated and contradictory performance ownership from general code review.
- Improve every public skill during migration: narrow its trigger, state near-miss exclusions, make it self-contained, remove stale APIs, resolve contradictions, and add behavior plus trigger evaluations. A mechanical rename is not acceptable.

---

## 1. Outcome

`Cratis/AI` becomes the public source repository for two separately distributed concerns:

1. reusable public Cratis capabilities that developers install in their preferred AI harness; and
2. reusable Cratis engineering configuration installed by Cratis maintainers without repository-to-repository propagation.

The public product artifact contains:

- Agent Skills;
- MCP server configuration and, when justified, separately packaged MCP servers;
- future portable component types added to the Agent Plugins specification;
- thin native manifests and marketplace catalogs required to distribute those same capabilities.

Repository-only engineering source, validation, evaluation, packaging, and release tooling remain in the repository but are excluded from the public runtime artifact.

The public product artifact does **not** distribute:

- repository rules or persistent instructions;
- `AGENTS.md`, `CLAUDE.md`, or other repository context;
- custom agents or subagents;
- prompt/command files;
- hooks;
- LSP servers;
- CI workflows as runtime components;
- skill `scripts/`;
- internal repository-operation skills;
- evaluation workspaces or authoring tools.

Reusable Cratis engineering configuration remains a separate artifact boundary under `engineering/` in this repository. Genuinely project-specific configuration belongs in `.cratis/PROJECT.md` in each consuming repository. Neither concern enters the public product artifact.

### Guiding architecture

```text
Cratis product knowledge
        │
        ▼
Canonical skills/ and optional mcp.json
        │
        ├── Agent Plugin 1.0             root plugin.json
        ├── GitHub skill releases        gh skill publish
        ├── Copilot marketplace          .github/plugin/marketplace.json
        ├── Cursor marketplace           root Agent Plugin
        ├── OpenAI/Codex wrapper         .codex-plugin/plugin.json
        ├── Claude wrapper               .claude-plugin/plugin.json
        ├── Gemini extension             gemini-extension.json
        ├── Pi package                   package.json → pi.skills
        ├── Junie extension              generated skills-only wrapper
        └── direct skill installation    gh skill install
```

The Agent Plugin is the canonical public plugin format. Native wrappers do not define different capabilities. They expose the same skills and MCP servers in clients that do not yet consume Agent Plugins directly.

---

## 2. Decisions

### 2.1 Public repository and artifact boundaries

Keep `Cratis/AI` public and retain its name. It has two source audiences with separate runtime artifacts:

| Concern | Source owner | Runtime distribution |
| --- | --- | --- |
| Portable public skills and optional MCP | Root `skills/` and public package sources | `@cratis/ai`, Agent Plugin, and native public wrappers |
| Reusable Cratis engineering rules, agents, prompts, hooks, and operational skills | `engineering/` in this repository | Separate native engineering installation, never `@cratis/ai` |
| Project-specific facts, build commands, credentials guidance, and environment endpoints | `.cratis/PROJECT.md` in the consuming repository | Project-owned context only |
| Stagehand control-plane behavior | `Cratis/Stagehand` | Stagehand-owned distribution |
| Ensemble/software-factory investigation roles and contracts | `Cratis/Ensemble` | Ensemble-owned distribution |
| Obsolete adapters and propagation machinery | No long-term owner | Delete after replacement pilots pass |

"Engineering" means Cratis-audience-specific, not confidential. Co-location keeps product knowledge and engineering workflows synchronized while package allowlists enforce the public runtime boundary. Reconsider a separate public `Cratis/AI.Cratis` repository only if ownership, release cadence, or confidentiality later requires it.

Do not copy the complete legacy corpus into `engineering/` without classification. For every artifact, decide whether it is public product knowledge, reusable engineering behavior, project-specific context, Stagehand/Ensemble behavior, or obsolete propagation residue.

### 2.2 Canonical public layout

After migration, `skills/` at the repository root is canonical. This is the native fixed location for Agent Plugins and is also discovered by GitHub CLI skill publishing.

Do not retain `.ai/skills` as the public canonical location merely to preserve the old adapter model. The old `.ai` model was designed for cross-repository propagation, not for public package distribution.

### 2.3 Public naming

Every published skill name starts with `cratis-`.

Reasons:

- skills share a global namespace in many harnesses;
- first-found-wins collisions occur in several clients;
- users can search and list Cratis capabilities consistently;
- slash invocation and diagnostics clearly identify the publisher;
- the prefix conforms to Agent Skills naming constraints.

Use this pattern:

```text
cratis-<product-or-workflow>-<capability>[-<language>]
```

Examples:

```text
cratis-arc-command
cratis-chronicle-projection
cratis-components-toolbar
cratis-specifications-csharp
cratis-chronicle-java-client
```

Rules:

1. Use lowercase ASCII letters, digits, and single hyphens only.
2. Keep the full name within 64 characters.
3. Make `name:` exactly equal the parent directory.
4. Avoid `add-`, `create-`, and `write-` when a stable capability noun is clearer.
5. Use the product qualifier when the behavior belongs to a specific product.
6. Use a language suffix only when build tooling, API shape, or workflow genuinely differs.
7. Do not publish `cratis-internal-*` or `cratis-engineering-*` skills from this repository.
8. Avoid two skills whose descriptions compete for the same user intent. Merge or sharpen them based on trigger evaluations.

### 2.4 Skill payload policy

A public skill may contain:

- `SKILL.md`;
- non-executable `references/**` linked from `SKILL.md`;
- approved non-executable `assets/**` when needed;
- `LICENSE` or attribution files when required.

A public skill may not contain:

- `scripts/**`;
- `evals/**`;
- agents, hooks, commands, or instructions;
- absolute paths to a Cratis developer workstation;
- links to private/internal files;
- instructions requiring private Cratis infrastructure;
- secrets, credentials, or test accounts.

Repository-level tooling may use scripts under `tooling/`; the package allowlist must ensure they are not shipped as skill resources.

### 2.5 MCP and executable code

Keep executable capabilities separate from the passive skills package:

- `@cratis/ai`: skills and manifests only;
- `@cratis/mcp`: future MCP server, only when there is a justified tool surface;
- `@cratis/pi`: optional Pi-native TypeScript extensions;
- optional shared implementation package if MCP and Pi expose the same underlying capability.

The Pi extension package must provide real Pi-native value. It must not exist only to relocate Markdown files.

### 2.6 Installation UX

Do not make `curl | sh` or `install.sh` the primary installation path.

Use native ecosystem installation first. For clients without plugin support, use official GitHub CLI skill installation:

```bash
gh skill install Cratis/AI --all --agent <agent> --scope user
```

`gh skill install` currently supports Copilot, Claude Code, Cursor, Codex, Gemini CLI, Junie, OpenCode, Pi, Grok, Kiro CLI, Qwen Code, and many others. This removes the need to maintain a fragile shell installer.

An optional convenience installer may be considered later only if native installation remains materially confusing. If created, it must have equivalent PowerShell support, must never request secrets, and must call native installers rather than copy files itself.

---

## 3. Target repository structure

```text
Cratis/AI/
├── plugin.json                         # Canonical Agent Plugins 1.x manifest
├── package.json                        # @cratis/ai and Pi package manifest
├── gemini-extension.json               # Gemini-native skills/MCP wrapper
├── README.md
├── INSTALL.md
├── CHANGELOG.md
├── LICENSE
│
├── skills/                             # Canonical public Agent Skills
│   ├── cratis-arc-command/
│   │   ├── SKILL.md
│   │   └── references/
│   └── cratis-*/
│       ├── SKILL.md
│       └── references/
│
├── engineering/                        # Cratis engineering source; never @cratis/ai
│   ├── rules/
│   ├── agents/
│   ├── prompts/
│   ├── hooks/
│   ├── skills/                         # Operational/contributor-only skills
│   └── catalog/                        # Engineering ownership and host support
│
├── mcp.json                            # Omit until at least one MCP server exists
│
├── .claude-plugin/
│   ├── plugin.json                     # Native Claude wrapper
│   └── marketplace.json                # Cratis Claude marketplace
│
├── .codex-plugin/
│   └── plugin.json                     # Native OpenAI/Codex wrapper
│
├── .agents/
│   └── plugins/
│       └── marketplace.json            # OpenAI/Codex repo marketplace
│
├── .github/
│   ├── plugin/
│   │   └── marketplace.json            # Copilot marketplace
│   ├── ISSUE_TEMPLATE/
│   ├── pull_request_template.md
│   └── workflows/
│       ├── validate.yml
│       ├── release.yml
│       ├── publish-npm.yml
│       ├── smoke-ecosystems.yml
│       ├── spec-watch.yml
│       └── publish-mcp.yml              # Add only with an MCP package
│
├── .cursor-plugin/
│   └── marketplace.json                # Only needed for a multi-plugin/team catalog
│
├── .junie-extension/
│   └── marketplace.json                # Generated/validated Junie catalog
├── extensions/
│   └── cratis/                         # Generated Junie skills-only wrapper
│       ├── extension.json
│       └── skills/
│
├── packages/
│   ├── pi/                             # Optional @cratis/pi executable package
│   └── mcp/                            # Optional @cratis/mcp executable package
│
├── catalog/
│   ├── public-skills.yml               # Deny-by-default public allowlist
│   ├── product-coverage.yml            # Product/language roadmap
│   └── ecosystem-versions.json         # Pinned schema/client assumptions
│
├── evals/                              # Authoring/evaluation only; never published
│   ├── triggers/
│   ├── behavior/
│   └── fixtures/
│
├── tooling/                            # Validation/generation/release tooling
│   ├── validate.mjs
│   ├── generate-native-manifests.mjs
│   ├── build-package.mjs
│   ├── verify-package-contents.mjs
│   ├── verify-links.mjs
│   └── verify-version-parity.mjs
│
└── Documentation/                      # Human-facing architecture/contribution docs
    ├── architecture.md
    ├── authoring-skills.md
    ├── ecosystem-support.md
    ├── publishing.md
    └── mcp.md
```

All generated files must include a generated marker where the target format permits comments. JSON files cannot contain comments; document their generated status in `Documentation/architecture.md` and enforce drift through CI.

---

## 4. Public skill migration

The current corpus contains 43 skills. The approved source classification is 35 public candidates and 8 Cratis engineering skills. Splitting `add-business-rule` into two focused public skills and merging the two vertical-slice skills yields 35 initial public skills if evaluations support both changes.

### 4.1 Recommended semantic rename map

This map is intentionally more descriptive than mechanically adding `cratis-`. Confirm each name with trigger evaluations before merging.

| Current skill | Recommended public name | Notes |
| --- | --- | --- |
| `add-business-rule` | split into `cratis-arc-command-validation` and `cratis-chronicle-event-constraints` | Separate command validation/state checks from event-store uniqueness and constraints; share references rather than trigger intent |
| `add-concept` | `cratis-fundamentals-concept` | `ConceptAs<T>` and `EventSourceId<T>` foundations |
| `add-ef-migration` | `cratis-arc-ef-core-migration` | Arc application EF Core integration |
| `add-projection` | `cratis-chronicle-projection` | Chronicle projections |
| `add-reactor` | `cratis-chronicle-reactor` | Chronicle automation/translation reactors |
| `add-reducer` | `cratis-chronicle-reducer` | Chronicle reducers |
| `auth-and-identity` | `cratis-arc-authentication-authorization-and-identity` | Keep authentication, authorization, identity providers, and frontend identity coherent; split later only if trigger evaluations require it |
| `call-command-from-code` | `cratis-arc-command-execution` | Backend command execution through `ICommandPipeline` |
| `cratis-command` | `cratis-arc-command` | Arc commands, including Chronicle integration where applicable |
| `cratis-react-page` | `cratis-arc-react-page` | Arc-generated proxies and Cratis Components |
| `cratis-readmodel` | `cratis-chronicle-read-model` | Chronicle read models and Arc queries |
| `cratis-specs-csharp` | `cratis-specifications-csharp` | Cratis.Specifications for C# |
| `cratis-specs-typescript` | `cratis-specifications-typescript` | Cratis TypeScript specification style |
| `cratis-vertical-slice` | `cratis-application-vertical-slice` | Canonical vertical-slice capability |
| `new-vertical-slice` | merge into `cratis-application-vertical-slice` | Avoid competing explainer/implementation skills; retain implementation workflow as references |
| `create-event-model` | `cratis-event-model-diagram` | Mermaid `EventModel.md` maintenance |
| `cross-cutting-properties` | `cratis-chronicle-event-metadata` | Additional event information and metadata |
| `diagnose-slice` | `cratis-application-slice-diagnostics` | Source/runtime diagnosis routing |
| `discover-implementations` | `cratis-fundamentals-type-discovery` | `IInstancesOf<T>` discovery conventions |
| `event-modeling` | `cratis-chronicle-event-modeling` | Domain and stream design before implementation |
| `event-type-migrations` | `cratis-chronicle-event-type-migration` | Event generations and upcasting |
| `inspect-running-chronicle` | `cratis-chronicle-cli-operations` | CLI inspection and operational diagnostics; separate read-only and destructive paths in the workflow and evals |
| `multi-tenancy` | `cratis-chronicle-multi-tenancy` | Chronicle namespaces and Arc tenant mapping |
| `observable-query-curl` | `cratis-arc-observable-query-http` | HTTP/SSE troubleshooting |
| `query-paging` | `cratis-arc-query-paging` | Server-side paging and React consumption |
| `review-code` | `cratis-code-review` | Cratis-aware review |
| `review-performance` | `cratis-performance-review` | Chronicle/.NET/React performance |
| `review-security` | `cratis-security-review` | Cratis-aware security review |
| `scaffold-feature` | `cratis-arc-react-feature-scaffolding` | React route, navigation, and empty feature shell before slices |
| `stepper-command-dialog` | `cratis-components-stepper-command-dialog` | Components wizard dialog |
| `toolbar` | `cratis-components-toolbar` | Components toolbar |
| `write-specs` | `cratis-application-slice-specifications` | Event-sourced application scenario routing |
| `write-specs-events` | `cratis-chronicle-event-specifications` | `EventScenario` |
| `write-specs-frontend` | `cratis-application-react-specifications` | React/TypeScript application specs |
| `write-specs-readmodels` | `cratis-chronicle-read-model-specifications` | `ReadModelScenario<T>` |

### 4.2 Cratis engineering skills excluded from public packaging

| Current skill | Engineering destination name |
| --- | --- |
| `add-cratis-docs-page` | `cratis-engineering-docs-add-page` |
| `edit-cratis-docs` | `cratis-engineering-docs-edit-page` |
| `qa-cratis-docs` | `cratis-engineering-docs-visual-qa` |
| `write-documentation` | `cratis-engineering-docs-authoring` |
| `ship-changes` | `cratis-engineering-ship-changes` |
| `add-traces` | `cratis-engineering-chronicle-kernel-tracing` |
| `cratis-csharp-standards` | `cratis-engineering-csharp-conventions` |
| `skill-creator` | retain upstream `skill-creator` in the engineering authoring toolchain |

The C# conventions skill is engineering policy, not an on-demand public Cratis product capability. Public skills should contain only the C# conventions required to perform their own workflow.

`skill-creator` is vendored Apache-2.0 content and is currently the only skill with a `scripts/` directory. Its scripts, agents, viewer, assets, references, and license stay together under `engineering/`. Fix its absolute workstation path before reuse.

### 4.3 Rename procedure

For each skill, one at a time:

1. Snapshot the current skill for behavior comparison.
2. Decide rename, merge, or retirement.
3. Use `git mv` for the directory.
4. Change `name:` to exactly match the new directory.
5. Rewrite `description:` to say what it does and when it triggers.
6. Remove reliance on shared rules; copy only essential domain facts into the skill or a linked public reference.
7. Remove links to internal agents, prompts, hooks, rules, and repository-specific paths.
8. Remove `scripts/` and `evals/` from runtime payloads.
9. Move evaluation definitions into root `evals/` and update their `skill_name`.
10. Update all cross-skill references.
11. Run static validation.
12. Run trigger and behavior evaluations against the old version.
13. Review results before moving to the next skill family.
14. Update `catalog/public-skills.yml` only after the skill passes.

Known cross-reference surfaces include `.ai/prompts/**`, `.ai/rules/**`, `.ai/agents/**`, other skills, and `Documentation/skills.md`. During the migration, use structural/link validation rather than assuming the known list is exhaustive.

### 4.4 Skill family review order

Review in dependency order:

1. `cratis-fundamentals-*`
2. specification foundations and any C# facts they require
3. `cratis-chronicle-event-modeling`
4. Arc command/query/auth skills
5. Chronicle event/projection/reducer/reactor/read-model skills
6. application vertical-slice and feature composition
7. Components/React skills
8. specification scenario skills
9. diagnostics, operations, review, security, and performance

---

## 5. Product and language coverage roadmap

Do not claim support merely because a product name appears in a description. Track coverage explicitly in `catalog/product-coverage.yml`.

Initial desired domains:

| Product/domain | Initial capability backlog |
| --- | --- |
| Cratis Fundamentals | concepts, type discovery |
| Cratis Arc | commands, queries, validation, authorization, identity, command pipeline |
| Arc for React | generated proxies, commands, observable queries, paging, page composition |
| Cratis Chronicle | events, event modeling, projections, read models, reducers, reactors, compliance, multi-tenancy, migrations, operations |
| Cratis Components | pages, dialogs, forms, data tables, stepper dialogs, toolbars |
| Cratis CLI | setup, project generation, Chronicle inspection, diagnostics |
| Cratis.Specifications | C# and TypeScript BDD, application scenarios |
| Chronicle clients | C#, Java, Kotlin, Elixir, and other supported client APIs |

Language policy:

- Keep one skill with language-specific references when the conceptual workflow is identical.
- Create separate skills when package setup, API shapes, error handling, or build/test workflows differ materially.
- Use product-first names, for example:

```text
cratis-chronicle-client-overview
cratis-chronicle-csharp-client
cratis-chronicle-java-client
cratis-chronicle-kotlin-client
cratis-chronicle-elixir-client
```

Before adding a language skill:

1. Verify the client exists and identify its supported version.
2. Use the product repository and published documentation as sources.
3. Record required runtime/toolchain details in `compatibility` only when necessary.
4. Add realistic behavior and trigger evaluations.
5. Do not translate a C# skill mechanically into another language.

High-priority missing public skills to evaluate:

```text
cratis-getting-started
cratis-cli
cratis-arc-query
cratis-arc-validation
cratis-arc-authorization
cratis-arc-react-client
cratis-chronicle-compliance
cratis-components-dialog
cratis-components-data-page
cratis-chronicle-<language>-client
```

---

## 6. Canonical manifests and scaffolding

### 6.1 Agent Plugin manifest

Create root `plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "cratis",
  "version": "1.0.0",
  "description": "Agent Skills for building applications with Cratis products.",
  "author": {
    "name": "Cratis",
    "url": "https://github.com/Cratis"
  },
  "homepage": "https://github.com/Cratis/AI",
  "repository": "https://github.com/Cratis/AI",
  "license": "MIT",
  "keywords": [
    "cratis",
    "arc",
    "chronicle",
    "agent-skills"
  ]
}
```

Constraints:

- `plugin.json` has a closed schema.
- Do not add `skills`, `mcpServers`, hooks, or client-specific fields at the top level.
- Skills are discovered from root `skills/`.
- Omit `mcp.json` until a server exists.
- All package-resolved paths must remain inside the plugin root.
- Materialized release archives must contain no escaping symlinks.

### 6.2 Root npm and Pi package

Publish the passive package as `@cratis/ai`:

```json
{
  "name": "@cratis/ai",
  "version": "1.0.0",
  "description": "Cratis Agent Skills and portable Agent Plugin manifests.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Cratis/AI.git"
  },
  "homepage": "https://github.com/Cratis/AI",
  "keywords": [
    "pi-package",
    "agent-plugin",
    "agent-skills",
    "cratis",
    "arc",
    "chronicle"
  ],
  "files": [
    "skills/",
    "plugin.json",
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
    "gemini-extension.json",
    "README.md",
    "INSTALL.md",
    "LICENSE"
  ],
  "pi": {
    "skills": ["./skills"]
  },
  "scripts": {
    "validate": "node tooling/validate.mjs",
    "pack:check": "node tooling/verify-package-contents.mjs"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

Use a `files` allowlist instead of `.npmignore`. Confirm hidden manifest directories appear in `npm pack --dry-run --json`.

### 6.3 Claude wrapper

Create `.claude-plugin/plugin.json`. It may identify `skills/` and native MCP configuration, but must not add agents, hooks, commands, or LSP servers.

Create `.claude-plugin/marketplace.json` with marketplace name `cratis`, owner metadata, and one plugin entry. Prefer an immutable npm version, release archive SHA-256, or Git tag plus full commit SHA over a moving branch.

Validate with the current `claude plugin validate` command and test:

```text
/plugin marketplace add Cratis/AI
/plugin install cratis@cratis
```

Re-verify exact commands before publishing.

### 6.4 OpenAI/Codex wrapper

Create `.codex-plugin/plugin.json` with:

- stable `name`;
- version parity with root `package.json`;
- `skills: "./skills/"`;
- optional native MCP mapping only when MCP exists;
- no hooks or extra capabilities.

Create `.agents/plugins/marketplace.json` for local/repository testing. OpenAI’s public plugin directory requires a separate portal submission; the local marketplace does not publish publicly.

### 6.5 Gemini extension

Create root `gemini-extension.json`. Keep it skills/MCP-only by policy.

Gemini gallery requirements currently include:

1. public GitHub repository;
2. `gemini-cli-extension` repository topic;
3. `gemini-extension.json` at the absolute repository/archive root;
4. successful validation by Gemini’s crawler.

Publish a self-contained GitHub Release archive whose root contains `gemini-extension.json`.

### 6.6 Copilot

Copilot recognizes Agent Plugins when root `plugin.json` declares the canonical Agent Plugins schema. Do not create a richer Copilot-specific plugin.

Create `.github/plugin/marketplace.json` and test:

```bash
copilot plugin marketplace add Cratis/AI
copilot plugin install cratis@cratis
```

Also test direct installation:

```bash
copilot plugin install Cratis/AI
```

After the first immutable release, submit the external plugin through the `github/awesome-copilot` external-plugin issue workflow. Use a public GitHub repository and an immutable tag and/or full 40-character SHA. Do not directly edit its external plugin catalog.

### 6.7 Cursor

Cursor consumes the root Agent Plugin without changes. Do not create `.cursor-plugin/plugin.json` unless Cratis later needs Cursor-only behavior, which is outside the current scope.

Host publicly and submit the repository through Cursor’s marketplace publishing flow. Test locally before submission. Add `.cursor-plugin/marketplace.json` only if Cratis publishes multiple Cursor plugins from the same repository or needs a team marketplace catalog.

### 6.8 Junie and JetBrains

Generate a skills-only Junie wrapper under `extensions/cratis/`:

```text
extensions/cratis/
├── extension.json
└── skills/
```

Use `.junie-extension/marketplace.json` following the current JetBrains repository shape. Treat this as provisional until JetBrains documents a public third-party submission process.

Rider is a host, not one packaging target. Rider users running Claude Agent or Codex can use their native skill support. Junie can use the generated extension or direct `gh skill install --agent junie`.

### 6.9 Direct skills distribution

Publish every release with:

```bash
gh skill publish --dry-run
gh skill publish --tag v1.0.0
```

The command validates strict Agent Skills naming, required frontmatter, name-directory parity, and repository discovery. It also adds the `agent-skills` repository topic and creates a GitHub release.

Users can install a specific skill or the whole set:

```bash
gh skill install Cratis/AI --all --agent pi --scope user
gh skill install Cratis/AI cratis-arc-command --agent claude-code --scope user
gh skill install Cratis/AI cratis-chronicle-projection@v1.0.0 --agent codex --scope project
gh skill update --all
```

Document that `gh skill` is currently preview functionality and may change.

---

## 7. MCP strategy

Do not create an MCP server merely to satisfy a distribution checklist.

Admit an MCP capability only when it offers data or actions that Markdown skills and normal shell tools cannot provide reliably.

Strong candidates:

- version-aware Cratis documentation and API lookup;
- read-only Chronicle discovery and health inspection;
- querying event types, read models, projections, observers, and failed partitions;
- project/package/profile detection;
- schema-aware Cratis CLI assistance.

Avoid initially:

- mutating Chronicle operations;
- replay/delete/reset tools without strong confirmation and authorization;
- generic build/test wrappers already available through shell commands;
- tools requiring private Cratis infrastructure for public users.

### MCP package architecture

```text
packages/shared-tools/     # Pure implementation, if sharing is useful
packages/mcp/              # @cratis/mcp
packages/pi/               # @cratis/pi
```

The MCP server and Pi extension may share implementation, but their adapters remain separate.

### MCP release requirements

1. Publish executable code separately from `@cratis/ai`.
2. Use least-privilege, read-only tools by default.
3. Give every tool precise schemas, descriptions, output schemas, and annotations.
4. Never embed credentials in manifests.
5. Support cancellation, bounded output, and explicit timeouts.
6. Redact secrets and personal data from errors and logs.
7. Add unit, protocol, and host integration tests.
8. Publish the executable package to npm with trusted publishing and provenance.
9. Publish public server metadata to the official MCP Registry when eligible.
10. Use a verified reverse-DNS/GitHub namespace such as an approved `io.github.cratis/...` name.
11. Generate root Agent Plugins `mcp.json` from one canonical server descriptor.
12. Generate native `.mcp.json`/manifest mappings for clients whose shape differs.
13. Test stdio on macOS, Linux, and Windows if using a local server.
14. Prefer Streamable HTTP for a hosted server; do not introduce legacy SSE for new work unless compatibility requires it.

OpenAI public submission additionally requires verified publisher identity, public policy/support URLs, tool scans, accurate read-only/open-world/destructive annotations, five positive and three negative tests, and review-ready credentials when authentication is required.

---

## 8. Pi packages and extensions

### `@cratis/ai`

Passive package containing the same public skills as the Agent Plugin:

```bash
pi install npm:@cratis/ai
```

Project-pinned installation:

```bash
pi install -l npm:@cratis/ai@1.0.0
```

This writes `.pi/settings.json`; Pi installs missing packages after project trust is granted.

### `@cratis/pi`

Create only when there is a genuine Pi-native executable capability. Place it under `packages/pi/` with:

```json
{
  "name": "@cratis/pi",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-tui": "*",
    "typebox": "*"
  }
}
```

Only list peer packages actually imported. Runtime dependencies belong in `dependencies`.

Pi extensions run with full system access. Keep this package separate from passive skills so users can make an informed trust decision.

Pi package-gallery discovery requires publishing to npm with the `pi-package` keyword. Git-only installation works but does not provide the same gallery discovery.

---

## 9. Validation and generation tooling

`tooling/validate.mjs` is the single local entry point. It should run these stages and fail with actionable messages.

### 9.1 Skill validation

- every direct child of `skills/` contains `SKILL.md`;
- every public skill name starts with `cratis-`;
- directory equals frontmatter `name`;
- strict Agent Skills name regex and 64-character limit;
- description exists, is at most 1024 characters, and states what/when;
- no unknown/nonportable frontmatter unless explicitly allowed;
- no `scripts/` or `evals/` below public skills;
- references are relative, resolve inside the skill, and are linked;
- no absolute workstation paths;
- no links to `.ai`, internal repos, rules, agents, hooks, prompts, or private paths;
- no broken anchors or markdown links;
- no duplicate names;
- no generated or binary junk;
- American English checks where reliable.

Also run:

```bash
gh skill publish --dry-run
```

### 9.2 Plugin validation

- validate `plugin.json` against the pinned Agent Plugins schema;
- reject unknown top-level fields;
- validate `mcp.json` against its schema when present;
- verify all resolved package paths stay under plugin root;
- reject escaping symlinks and preferably all symlinks in release archives;
- verify native wrappers expose exactly the public catalog skills;
- validate Claude, Gemini, Copilot, Cursor, Codex, and Junie manifests using their current validators when available;
- verify marketplace sources are immutable for releases.

### 9.3 Package-content validation

Build into a new empty staging directory. Never package directly from the working tree.

Allow only:

- public skills and approved references/assets;
- public manifests/catalog metadata required at runtime;
- README, INSTALL, CHANGELOG, LICENSE;
- MCP configuration when present.

Reject:

- `.ai/**` legacy content;
- internal skills;
- rules, instructions, agents, prompts, commands, hooks, workflows, LSP;
- `tooling/**`, `evals/**`, tests, coverage, task/fusion output;
- `.git/**`, local settings, editor state;
- skill scripts;
- secrets and private URLs.

Run `npm pack --dry-run --json`, inspect every path, unpack the tarball, and rerun manifest/skill validation against the unpacked artifact.

### 9.4 Version parity

One canonical version drives the passive product:

- root `package.json`;
- root `plugin.json`;
- Claude manifest/marketplace;
- Codex manifest/marketplace;
- Gemini manifest;
- Copilot marketplace;
- Junie extension/marketplace;
- generated release archive names.

`verify-version-parity.mjs` must fail on any mismatch.

Executable `@cratis/mcp` and `@cratis/pi` packages may version independently once they exist.

---

## 10. Evaluation strategy

Static conformance does not establish skill usefulness.

For each public skill, maintain outside the runtime skill directory:

- 2–3 behavior prompts for initial migration;
- expected outcomes and objective assertions where possible;
- 8–10 realistic trigger prompts;
- 8–10 difficult near-miss prompts that should not trigger;
- fixtures that contain no private data.

For renamed or merged skills:

1. Run the old skill as baseline.
2. Run the new skill against the same prompts.
3. Capture output, token usage, duration, and assertions.
4. Perform human review.
5. Reject changes that merely increase compliance text while reducing task quality.
6. Test adjacent skills together to detect trigger collisions.

Critical collision sets:

- event modeling vs event-model diagram;
- Arc command vs command pipeline vs business rule;
- projection vs read model vs reducer;
- generic C# specs vs application scenario specs;
- vertical slice vs feature scaffolding;
- diagnostics vs Chronicle operations.

OpenAI public submission requires five positive and three negative plugin tests; maintain a reusable plugin-level set from the beginning.

---

## 11. GitHub Actions workflows

Pin third-party actions to full commit SHAs and document the corresponding release tags in comments. Use GitHub-hosted runners for npm trusted publishing.

### 11.1 `validate.yml`

Triggers:

- pull requests;
- pushes to `main`;
- manual dispatch.

Jobs:

1. checkout;
2. setup pinned Node/npm;
3. install with lockfile;
4. run `npm run validate`;
5. run `gh skill publish --dry-run`;
6. generate native manifests into a temporary directory;
7. diff generated output against committed manifests;
8. build staging package;
9. run `npm pack --dry-run --json`;
10. unpack and validate artifact;
11. run behavior/trigger smoke subset;
12. upload validation report, not package secrets.

### 11.2 `release.yml`

Trigger:

- manual version input after an approved release PR, or an approved release automation PR.

Steps:

1. verify clean `main` commit;
2. verify semantic version and changelog;
3. update every passive-product manifest from root version;
4. run the full validation/evaluation gate;
5. create immutable tag `vX.Y.Z`;
6. use `gh skill publish --tag vX.Y.Z` or create the release in one idempotent path, never both independently;
7. build self-contained release archives;
8. attach checksums and archives to the GitHub Release;
9. invoke npm publication through a reusable workflow or release event;
10. emit a marketplace submission/update checklist artifact.

### 11.3 `publish-npm.yml`

Requirements:

```yaml
permissions:
  contents: read
  id-token: write
```

Use:

- GitHub-hosted runner;
- Node 22.14+;
- npm 11.5.1+;
- npm trusted publisher configured for the exact repository, workflow filename, and optional GitHub environment;
- `npm publish --access public` for a scoped public package;
- automatic provenance from trusted publishing;
- no long-lived npm publish token.

Before publish:

1. verify tag equals package version;
2. download or rebuild the validated artifact deterministically;
3. inspect tarball allowlist;
4. check that the version does not already exist;
5. publish exactly once.

### 11.4 `smoke-ecosystems.yml`

Run weekly and manually. Use a matrix for available CLIs:

- Agent Plugin schema/reference validator;
- Copilot direct/local plugin installation;
- Claude local marketplace/plugin validation;
- Gemini extension link/install validation;
- Codex local marketplace parsing;
- Pi temporary package loading;
- `gh skill install` into temporary directories for representative agents;
- Cursor schema validation/local plugin load where automatable;
- Junie structural validation where automatable.

Do not require paid interactive authentication in PR validation. Separate authenticated canaries into protected environments.

### 11.5 `spec-watch.yml`

Run weekly or monthly:

1. query the Agent Plugins specification repository for newer published versions;
2. compare Agent Skills specification assumptions;
3. compare current marketplace/native schema identifiers;
4. compare pinned supported CLI minimum versions;
5. open or update one tracking issue when drift exists;
6. never auto-upgrade schemas or publish automatically.

Track assumptions in `catalog/ecosystem-versions.json` with source URL, verified date, and current version.

### 11.6 `publish-mcp.yml`

Do not add until `@cratis/mcp` exists. It must:

- run protocol/unit/security tests;
- build cross-platform artifacts if needed;
- publish npm with trusted publishing/provenance;
- produce SBOM and checksums;
- publish/update MCP Registry metadata;
- test installation through root Agent Plugin `mcp.json`;
- deploy remote service before updating a Streamable HTTP manifest;
- require a protected production environment for mutating or hosted capabilities.

---

## 12. Release and versioning policy

Release the redesigned public product as `v1.0.0`. The old corpus adapters were not a stable public plugin contract; do not ship compatibility stubs for every old skill name unless evidence shows external usage.

SemVer guidance:

- **Patch:** corrections that do not materially change trigger intent or workflow contract.
- **Minor:** new skill, new references, backwards-compatible workflow improvement, or new marketplace support.
- **Major:** skill rename/removal, major trigger intent change, incompatible MCP tool/schema change, or package/install contract change.

Every release must include:

- changelog grouped by skills, MCP, ecosystems, and fixes;
- complete skill inventory;
- migration notes for renamed/removed skills;
- GitHub Release and immutable tag;
- npm package with provenance;
- checksums for archives;
- marketplace update/submission status;
- known harness limitations.

Do not publish directly from a developer machine except for an explicitly documented emergency recovery procedure.

---

## 13. Marketplace publication playbooks

### Agent Plugins-compatible clients

Current documented clients include Cursor, GitHub Copilot, ChatGPT & Codex, Kiro, Hermes Agent, Grok Bot, and NanoClaw. Clients may adopt component types incrementally, so test both skills and each MCP transport actually used.

### GitHub Copilot

1. Validate root Agent Plugin.
2. Publish own `.github/plugin/marketplace.json`.
3. Test direct and marketplace installs.
4. Release immutable tag and SHA.
5. Submit an external-plugin issue to `github/awesome-copilot`.
6. Satisfy its security/responsible-AI policies.
7. Do not open a direct catalog PR unless instructed by maintainers.
8. Verify listing from both Copilot CLI and VS Code after approval.

### Cursor

1. Validate root Agent Plugin against official schemas.
2. Test locally.
3. Ensure README and optional logo are public and stable.
4. Submit the public repository through Cursor Marketplace.
5. Complete manual review.
6. Verify user- and project-scope installation.
7. Do not add Cursor-specific capabilities without a separate approved decision.

### OpenAI ChatGPT/Codex

1. Build `.codex-plugin/plugin.json` and local marketplace.
2. Test in a local/repository marketplace.
3. Obtain OpenAI organization Apps Management write access.
4. Verify Cratis business/developer identity.
5. Prepare public website, support, privacy, and terms URLs.
6. Prepare logo, descriptions, category, starter prompts, release notes.
7. Supply at least five positive and three negative tests.
8. For MCP, provide public server URL, domain verification, auth/demo credentials, tool annotations, and tool scan.
9. Submit through the OpenAI plugin submission portal.
10. Address automated and human review feedback.
11. Verify the universal public listing in ChatGPT and Codex surfaces.

### Claude Code

1. Validate `.claude-plugin/plugin.json` and marketplace.
2. Test local marketplace add/install/update.
3. Host own marketplace in `Cratis/AI`.
4. Pin release source to npm version, archive hash, tag/SHA, or another immutable source.
5. Submit to Anthropic’s current community/official marketplace process if open to third-party submissions.
6. Re-verify policy and submission location at release time.
7. Verify update behavior after a version bump.

### Gemini CLI

1. Put `gemini-extension.json` at repository root.
2. Add `gemini-cli-extension` GitHub topic.
3. Validate locally with current Gemini CLI.
4. Publish Git tag and Latest GitHub Release.
5. Ensure manifest version and release tag match.
6. Attach a self-contained archive with manifest at archive root.
7. Wait for daily gallery crawl.
8. Verify listing and installation from the gallery.

### Pi

1. Publish `@cratis/ai` to npm with `pi-package` keyword.
2. Verify `pi install npm:@cratis/ai`.
3. Verify skills appear and load on demand.
4. Verify the package appears at `pi.dev/packages`.
5. Publish `@cratis/pi` separately only when extensions exist.
6. Document full-system-access implications for executable extensions.

### GitHub Agent Skills

1. Add `agent-skills` topic.
2. Run `gh skill publish --dry-run` in CI.
3. Use `gh skill publish --tag vX.Y.Z` as part of release.
4. Verify `gh skill search`/preview/install behavior after indexing.
5. Document `gh skill update --all` and pinning.

### Junie/JetBrains

1. Produce generated skills-only Junie extension.
2. Validate against current official `junie-extensions` examples.
3. Use direct `gh skill install --agent junie` as the supported fallback.
4. Contact JetBrains or follow its documented contribution process when one is available.
5. Do not claim official marketplace listing before confirmation.

### OpenCode, Zed, DeepSeek Harness, and other skill clients

- OpenCode reads strict Agent Skills from `.agents/skills`; use `gh skill install --agent opencode`.
- Zed reads Agent Skills from `.agents/skills`; use `gh skill install` with an appropriate target/custom directory until a native package channel exists.
- DeepSeek Harness currently reads direct skills from `.agents/skills` and `.dsh/skills`; Agent Plugins support is unverified. Treat it as a skill-only compatibility target and add a native package only after its official packaging mechanism stabilizes.
- A model such as DeepSeek used through Pi, Cursor, Copilot, or another harness needs no model-specific Cratis package. Packaging follows the harness, not the model.

---

## 14. Cratis engineering corpus and propagation retirement

The redesign must preserve useful Cratis engineering behavior without copying shared harness configuration into every repository.

### Ownership reduction before relocation

Classify every current rule, agent, prompt, hook, workflow, adapter, and engineering skill into exactly one destination:

1. **Public product capability** — move essential product behavior into a self-contained public skill or reference.
2. **Reusable Cratis engineering behavior** — move under `engineering/` in this repository.
3. **Project-specific context** — move to `.cratis/PROJECT.md` in the consuming repository.
4. **Stagehand or Ensemble behavior** — move to the owning product.
5. **Propagation or adapter residue** — delete after replacement pilots pass.

Do not preserve the entire legacy `.ai` tree merely because it exists. The objective is a smaller canonical engineering corpus and less persistent context, not a differently named sync hub.

### Harness-neutral project context

`.cratis/PROJECT.md` becomes the canonical location for project-local facts such as build commands, profiles, endpoints, and credential-handling guidance. It is owned by the consuming repository and is never propagated.

During migration:

- read `.cratis/PROJECT.md` first;
- fall back to `.agents/PROJECT.md` only while the old path exists;
- merge carefully when both exist, with `.cratis/PROJECT.md` authoritative;
- never overwrite project content;
- remove the old file only after every supported harness can discover the new location through installed Cratis engineering guidance.

### Native installation instead of propagation

The target is to empty shared content from `.claude/`, `.agents/`, and Copilot-specific folders in consuming repositories so those locations are available for project-owned configuration.

Use this order:

1. install public skills through `@cratis/ai`, Agent Plugins, or `gh skill install`;
2. install Cratis engineering capabilities through separately generated native packages/plugins at user or organization scope;
3. keep a minimal project-owned bootstrap only for a harness that cannot load installed engineering guidance;
4. document capability differences honestly where a harness cannot expose rules, agents, prompts, or hooks;
5. stop broad propagation after one application and one framework pilot pass;
6. remove copied adapters and shared files from consuming repositories without deleting project-owned additions.

Do not force all engineering artifacts through the portable Agent Plugin. Agent Plugins remain the canonical public skills/MCP format; richer engineering components may require native wrappers generated from the same `engineering/` source.

### Protected existing work

Preserve and finish the current uncommitted hook/validator work as one coherent engineering change. Snapshot it before relocation, copy it under the new engineering ownership, validate equivalent behavior, and retain the original until the replacement pilot passes. Do not reset, overwrite, or silently absorb:

- `.ai/hooks/agent-stop.md`;
- `.ai/hooks/pre-commit.md`;
- `.ai/hooks/scripts/validate-ai-setup.sh`;
- `.gitignore`.

No public history rewrite is required.

---

## 15. Implementation phases and gates

### Phase 0 — Protect and decide

- [x] Record fresh `git status`, unstaged diff names, and staged diff names.
- [x] Protect the four known modified files.
- [x] Keep one public repository with separate public-product and engineering artifact boundaries.
- [x] Verify that the Cratis npm scope exists and the proposed names are unpublished.
- [x] Approve public package names: `@cratis/ai`, future `@cratis/mcp`, and future `@cratis/pi`.
- [x] Approve `cratis` as the plugin/marketplace identifier.
- [x] Approve no public history rewrite.
- [x] Approve a gated vertical-slice merge experiment and focused performance-review skill.
- [x] Classify `add-traces` and C# conventions as engineering skills.

**Gate:** this handover and the architecture ADR record the maintainer direction. Trusted-publisher access remains a release gate rather than a Phase 1 blocker.

### Phase 1 — Reduce and separate ownership in place

- [ ] Create `engineering/` ownership scaffolding and a deny-by-default engineering catalog; do not create package manifests yet.
- [ ] Classify every current rule, agent, prompt, hook, workflow, adapter, and non-public skill into public, engineering, project, Stagehand/Ensemble, or obsolete.
- [ ] Move the eight engineering skills and vendored `skill-creator` bundle only after their dependencies are recorded.
- [ ] Define `.cratis/PROJECT.md` and a lossless migration from `.agents/PROJECT.md`.
- [ ] Preserve and incorporate the protected hook/validator work without staging unrelated changes.
- [ ] Design native engineering installation and a harness capability matrix; do not implement propagation replacements yet.
- [ ] Freeze additions to the old propagation model.
- [ ] Remove public-to-engineering references or convert essential facts into public references.

**Gate:** every legacy artifact has one explicit owner, no public candidate depends on engineering content, and the replacement plan can free harness-specific directories without losing project context.

### Phase 2 — Establish public root

- [ ] Create root `skills/`.
- [ ] Move public candidates with `git mv`.
- [ ] Update the deny-by-default catalog for the approved split, merge, and engineering classifications.
- [ ] Add strict public-skill and cross-reference validation.
- [ ] Keep manifests, npm packaging, and adapter retirement deferred to their later pull requests.
- [ ] Replace stale documentation.

**Gate:** every root public skill is self-contained, cataloged, and statically valid; no runtime package exists yet.

### Phase 3 — Rename and improve skills

- [ ] Process skill families in dependency order.
- [ ] Run behavior and trigger evaluations.
- [ ] Merge competing vertical-slice skills if evaluations support it.
- [ ] Review every reference for current public product behavior.
- [ ] Generate public catalog documentation.

**Gate:** strict validation and approved human evaluation for every initial skill.

### Phase 4 — Native ecosystem wrappers

- [ ] Agent Plugin root.
- [ ] Claude wrapper/marketplace.
- [ ] Codex wrapper/local marketplace.
- [ ] Gemini extension.
- [ ] Copilot marketplace.
- [ ] Cursor submission metadata.
- [ ] Pi package.
- [ ] Junie generated wrapper.

**Gate:** local install smoke tests pass on each available client.

### Phase 5 — CI and supply chain

- [ ] Validation workflow.
- [ ] Artifact-content test.
- [ ] Version-parity test.
- [ ] npm trusted publisher and protected environment.
- [ ] Release workflow.
- [ ] Scheduled ecosystem/spec canary.
- [ ] Dependency/security scanning for executable packages.

**Gate:** release candidate can be reproduced from a clean checkout.

### Phase 6 — First public release

- [ ] Publish `v1.0.0` skill release.
- [ ] Publish `@cratis/ai` with provenance.
- [ ] Attach archives/checksums.
- [ ] Verify direct installation.
- [ ] Verify Pi gallery and Gemini gallery discovery.
- [ ] Submit to Copilot, Cursor, OpenAI, Claude, and JetBrains channels as applicable.

**Gate:** installation evidence recorded for every Tier 1 target.

### Phase 7 — Retire propagation

- [ ] Confirm public and engineering installations work in pilot repos.
- [ ] Disable broad sync workflows.
- [ ] Remove obsolete propagation scripts.
- [ ] Document intentional project-local bootstrap files.
- [ ] Monitor failures and adoption for one release cycle.

**Gate:** no consuming repository depends on copied public skills from the old propagation workflow.

---

## 16. Support tiers

### Tier 1 — release tested

- Agent Plugins 1.x;
- GitHub Agent Skills releases;
- GitHub Copilot;
- Cursor;
- ChatGPT/Codex;
- Claude Code;
- Gemini CLI;
- Pi.

### Tier 2 — compatibility tested or documented

- Junie/JetBrains;
- OpenCode;
- Kiro;
- Hermes Agent;
- Grok Bot;
- NanoClaw;
- Zed;
- DeepSeek Harness.

### Tier 3 — model/provider only

DeepSeek models, Qwen models, and other providers running inside a supported harness inherit that harness’s package. Do not create duplicate model-specific distributions.

Publish the matrix in `Documentation/ecosystem-support.md` with statuses:

- `native-agent-plugin`;
- `native-wrapper`;
- `direct-agent-skills`;
- `experimental`;
- `not-supported`.

---

## 17. Security and quality requirements

- Use a public allowlist, never a public denylist.
- Run secret scanning before packaging and release.
- Never include private URLs, credentials, tokens, or internal test data.
- Use immutable marketplace sources for releases.
- Use npm trusted publishing and provenance.
- Produce checksums and attestations for executable artifacts.
- Keep passive and executable npm packages separate.
- Treat MCP and Pi extensions as code with full security review.
- Document network, filesystem, and authentication requirements.
- Require explicit confirmation for destructive operations.
- Bound MCP/Pi outputs to protect context windows.
- Maintain privacy policy, terms, support, and security-reporting URLs before public marketplace submissions.
- Add `SECURITY.md` with private vulnerability reporting instructions.
- Add `CODEOWNERS` for manifests, publishing workflows, skills, and executable packages.
- Protect release environments and require reviewer approval for executable publication/deployment.

---

## 18. Definition of done

The redesign is complete only when all are true:

### Repository

- [ ] Root `skills/` is the only public skill source.
- [ ] Every public skill starts with `cratis-` and matches its directory.
- [ ] No public skill includes scripts or internal references.
- [ ] Internal rules, instructions, agents, prompts, hooks, and operational skills are absent from public packages.
- [ ] Planner/Factory residue has an explicit owner or is removed.

### Portable package

- [ ] Root Agent Plugin validates against the current published specification.
- [ ] Published tarball/archive is self-contained.
- [ ] No escaping symlinks or forbidden content exists.
- [ ] Skills and optional MCP are the only portable components.

### Native ecosystems

- [ ] Copilot installs the root Agent Plugin.
- [ ] Cursor installs the root Agent Plugin.
- [ ] Codex/ChatGPT wrapper and submission work.
- [ ] Claude wrapper and marketplace work.
- [ ] Gemini extension installs and is gallery eligible.
- [ ] Pi npm package installs and appears in its catalog.
- [ ] `gh skill install` works for representative direct-skill clients.
- [ ] Junie/JetBrains support is accurately documented without overstating marketplace status.

### Release

- [ ] GitHub Release is immutable and version aligned.
- [ ] `@cratis/ai` is published with provenance.
- [ ] Release archive checksums are available.
- [ ] CI validates unpacked artifacts.
- [ ] Scheduled ecosystem/spec monitoring exists.

### Quality

- [ ] Every initial skill has behavior and trigger tests.
- [ ] Adjacent skills have collision tests.
- [ ] Public catalog and documentation are generated and current.
- [ ] A clean checkout can reproduce the released artifact.

---

## 19. Sources to re-verify

### Standards

- Agent Plugins: <https://agent-plugins.org/specification>
- Compatible Agent Plugins clients: <https://agent-plugins.org/compatible-clients>
- Agent Skills: <https://agentskills.io/specification>
- MCP: <https://modelcontextprotocol.io/>
- MCP Registry: <https://modelcontextprotocol.io/registry/about>

### Distribution ecosystems

- GitHub Copilot plugins: <https://docs.github.com/en/copilot/concepts/agents/about-plugins>
- Copilot plugin reference: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
- GitHub CLI skills: <https://cli.github.com/manual/gh_skill>
- OpenAI plugin packaging: <https://developers.openai.com/codex/plugins/build>
- OpenAI plugin submission: <https://developers.openai.com/plugins/deploy/submission>
- Claude plugins: <https://code.claude.com/docs/en/plugins-reference>
- Claude marketplaces: <https://code.claude.com/docs/en/plugin-marketplaces>
- Gemini extensions: <https://geminicli.com/docs/extensions/reference/>
- Gemini releases/gallery: <https://geminicli.com/docs/extensions/releasing/>
- Cursor plugins: <https://cursor.com/docs/reference/plugins>
- Junie extensions: <https://github.com/JetBrains/junie-extensions>
- Pi packages: local installed Pi documentation `docs/packages.md`
- Pi skills: local installed Pi documentation `docs/skills.md`
- Pi extensions: local installed Pi documentation `docs/extensions.md`
- npm trusted publishing: <https://docs.npmjs.com/trusted-publishers>

---

## 20. First implementation pull requests

Do not combine the entire redesign into one pull request.

1. **ADR and catalog scaffold**
   - decisions, target tree, deny-by-default catalog, no moved content.
2. **Engineering ownership reduction**
   - co-located `engineering/` scaffold, complete artifact classification, project-context migration design, and propagation replacement plan; no content moves.
3. **Engineering source move**
   - move approved reusable engineering content in place, preserve hook work, and assign Stagehand/Ensemble/project/obsolete content; no native package yet.
4. **Public skill root and static validator**
   - root `skills/`, strict validation, no packaging yet.
5. **Skill naming family 1**
   - Fundamentals and specification foundations.
6. **Skill naming family 2**
   - Arc skills, including business-rule split evaluation.
7. **Skill naming family 3**
   - Chronicle skills.
8. **Skill naming family 4**
   - React/Components/application skills, including the gated vertical-slice merge.
9. **Review/diagnostics skills and security pass**
10. **Agent Plugin and npm/Pi package**
11. **Public native ecosystem wrappers**
12. **Engineering native installation and migration pilots**
13. **Release and supply-chain workflows**
14. **Marketplace submissions and installation documentation**
15. **Propagation retirement**

Each pull request must include fresh validation evidence and must not absorb the pre-existing uncommitted files without explicit approval.

---

## 21. Next implementation session

The canonical continuation handover is:

- [`AI-REPOSITORY-REDESIGN-NEXT-SESSION-HANDOVER.md`](./AI-REPOSITORY-REDESIGN-NEXT-SESSION-HANDOVER.md)

Before PR-2, run the complete discovery and ecosystem/specification reevaluation
prompt:

- [`AI-REPOSITORY-REDESIGN-REEVALUATION-PROMPT.md`](./AI-REPOSITORY-REDESIGN-REEVALUATION-PROMPT.md)

That reevaluation must produce the next evidence-based implementation prompt.
Do not resume PR-2 from an older embedded prompt.
