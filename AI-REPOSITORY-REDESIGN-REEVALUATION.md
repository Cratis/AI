# Cratis/AI Repository Redesign Reevaluation

> **Preserved evidence; no longer the operational entry point.** Later ecosystem,
> third-party, Pi, persona, and distribution research produced the accepted
> autonomous Option A+ program. Continue from
> [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md).

**Reevaluated:** 2026-08-20
**Verdict:** **Redesign required** before the deferred PR-2
**Canonical handover:** [`AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md`](./AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md)
**Implementation plan:** [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md)
**Continuation prompt:** [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md)

## 1. Executive verdict

The public-skills direction is valuable, and the deny-by-default catalog is a useful audit scaffold, but the proposed architecture is not yet safe or authoritative enough to implement.

Five findings require redesign:

1. **Distribution is not an accepted decision.** The organization migration epic says `Cratis/AI` is corpus-only and [`Cratis/Workflows#68`](https://github.com/Cratis/Workflows/issues/68) still lists the replacement distribution artifact and versioning model as undecided. The untracked redesign handovers overstate native installation and propagation retirement as approved.
2. **A co-located source checkout is not the public artifact.** `gh skill install --all` recursively discovers standard skill paths under repository prefixes. A future `engineering/skills/` tree could therefore be installed even when the catalog denies it. Direct Git/plugin installation can also materialize source content that the proposed runtime boundary says must never ship.
3. **Native engineering parity is impossible.** Agent Plugins 1.0 carries only skills and MCP portably. Native clients support different subsets of persistent instructions, agents, commands, hooks, MCP, and LSP. No one package can expose all engineering behavior across every claimed harness.
4. **`.cratis/PROJECT.md` is a good ownership location but not a discovery convention.** None of the verified harnesses automatically loads that arbitrary path. Host-recognized, project-owned bootstrap files or explicit user/managed configuration remain necessary.
5. **The catalogs validate their own shape, not a release artifact.** They do not materialize an exact allowlisted tree, enforce payload patterns, reject symlinks, hash files, validate an unpacked archive, or model split/merge targets and evidence-bound approval independently.

### Recommendation

Keep `Cratis/AI` as the canonical corpus source unless maintainers choose a separate product repository, but **materialize public releases into a clean, public-only tree**. Use an immutable release commit/tag/archive or a separately accepted distribution repository/ref. Never run plugin publication or `gh skill --all` against a source tree containing engineering content.

Keep engineering capability source in a deliberately non-auto-discovered path such as `engineering/capabilities/`, not `engineering/skills/`. Generate host-native packages from it only after a per-host capability decision. Preserve minimal project-owned bootstraps where host evidence requires them.

No source move, plugin manifest, package manifest, publication, propagation retirement, commit, push, or pull request was performed during this reevaluation.

## 2. Protected worktree and repository state

Session-start state was `main` tracking `origin/main`, with no staged files. Protected pre-existing changes were:

- `.ai/hooks/agent-stop.md`;
- `.ai/hooks/pre-commit.md`;
- `.ai/hooks/scripts/validate-ai-setup.sh`;
- `.gitignore`;
- `Documentation/index.md`;
- the untracked redesign handovers, prompt, documentation, catalogs, schemas, and tooling.

The four specifically named protected files were not edited. `Documentation/index.md` was not edited. `.pi` task, delegate, and Fusion artifacts were not treated as policy and were not cleaned.

The local `main` was at `158bcab` (`Make the AI repository a pure corpus repository`). During the session, read-only remote discovery showed `origin/main` at `b795d53`, four commits ahead of the local branch. No pull, reset, rebase, or history change was performed.

## 3. Related source and decision inventory

Authority levels used below:

- **Organization authority:** accepted cross-repository ownership or migration record.
- **Repository authority:** merged current source, rules, or maintainer issue/PR record.
- **Proposal:** unmerged/untracked design, open experiment, or unresolved decision.
- **Legacy:** accurate only for the current adapter/propagation tree.
- **External authority:** current official specification or vendor documentation.

### 3.1 Governance and maintainer decisions

| Source | Purpose and authority | Status and contributed facts | Disposition |
| --- | --- | --- | --- |
| [`Cratis/.github#24`](https://github.com/Cratis/.github/issues/24) | Organization migration epic | **Current organization authority.** AI is “shared AI corpus only”; propagation is frozen; replacement distribution must be accepted and canaried. | Governs repository ownership until explicitly changed. |
| [`Cratis/Workflows#68`](https://github.com/Cratis/Workflows/issues/68) | Replacement distribution decision | **Current unresolved authority.** Package/version, Git sync, PR sync, submodule, generated bundle, overrides, rollback, and wrapper retirement remain open. | Must be resolved or explicitly deferred before source moves. |
| [`Cratis/AI#126`](https://github.com/Cratis/AI/issues/126) | Corpus-only cleanup | Current repository follow-up: generic gates, obsolete package workflow, Pi adapter policy, and misleading defaults remain unresolved. | Include in ownership reduction. |
| [`Cratis/AI#127`](https://github.com/Cratis/AI/issues/127) | History-purge follow-up | Records that an approved one-off rewrite already removed Planner/Ensemble paths from normal refs, while GitHub PR refs remain reachable. | Corrects the handover’s “no history rewrite” narrative; do not perform another rewrite here. |
| [`Cratis/AI#29`](https://github.com/Cratis/AI/issues/29) | Packaging goal | Current maintainer goal: package Cratis knowledge for Claude/Copilot and add Pi support; public packaging remains open. | Product intent, not proof of a particular architecture. |
| [`Cratis/AI#35`](https://github.com/Cratis/AI/issues/35) and [PR #44](https://github.com/Cratis/AI/pull/44) | Project-context failure | A foreign `.agents/PROJECT.md` propagated and outranked correct project context; the copy was removed and workflow ownership moved to Workflows. | Strong evidence for project ownership and against broad propagation. |
| [PR #30](https://github.com/Cratis/AI/pull/30) | Prior plugin experiment | Closed, unmerged experiment. It established maintainer preference for identifier `cratis` and automated publishing, but its endpoint/token marketplace design is superseded by current official mechanisms. | Historical proposal only; do not restore. |
| [PR #34](https://github.com/Cratis/AI/pull/34) | `.agents/PROJECT.md` and adapters | Merged legacy decision; also knowingly broke Copilot scoped-rule suffix discovery by replacing per-file adapters with a folder symlink. | Current-tree history, not target architecture. |
| [PR #103](https://github.com/Cratis/AI/pull/103) | Append-only Git policy | Merged universal rule against rewriting history, following the earlier explicitly approved exceptional purge. | Retain as normal policy. |
| [PR #128](https://github.com/Cratis/AI/pull/128) | Ensemble terminology | Merged ownership correction for investigation agents. | Keep terminology aligned with Ensemble. |
| [`Cratis/Ensemble#13`](https://github.com/Cratis/Ensemble/issues/13) | Ensemble program authority | Ensemble owns governed workflows, profiles, capability policy, evaluation, and evidence; skills influence behavior but grant no authority. | Do not move Ensemble control-plane behavior into AI skills. |
| `../Stagehand/README.md` | Local sibling ownership evidence | Stagehand owns durable managed control-plane state, workers, credentials, scheduling, and callbacks. | Keep operational orchestration out of AI. |
| `../Ensemble/README.md` and `Documentation/Ensemble/architecture.md` | Local sibling ownership evidence | Ensemble owns deterministic workflow/profile/evidence contracts and content-addressed vocabulary inputs. | AI may supply versioned knowledge bytes, not runtime authority. |
| `../Documentation/README.md` | Documentation ownership | Product repositories own their documentation; the Documentation repository aggregates it. | Supports engineering ownership of docs-operation skills. |

No relevant GitHub discussions existed. GitHub issues and pull requests were inspected read-only through authenticated `gh`; no issue, PR, comment, release, or repository setting was changed.

### 3.2 Current repository documents

| Path | Purpose | Authority/status | Conflict or disposition |
| --- | --- | --- | --- |
| `README.md` | Current corpus purpose and adapters | Repository authority, legacy | Correct for today’s `.ai` source model; conflicts with a root public-plugin model. |
| `.ai/README.md` | Corpus authority layers and adapter rules | Repository authority, legacy | Claims Claude hook wiring in `.claude/settings.json`, but that file is not tracked. |
| `.ai/rules/general.md` | Universal/application/framework operating rules | Highest current corpus authority | Still points to `.agents/PROJECT.md`; project-context migration remains pending. |
| `.ai/rules/managing-ai-rules.md` | Adapter and propagation maintenance | Repository authority, legacy | Documents folder-symlink caveat and all-to-all propagation. Retire only after a replacement pilot. |
| `.ai/hooks/README.md` | Hook enforcement design | Repository authority with drift | Says only Claude wiring exists, but tracked Pi hook wiring now exists and tracked Claude settings do not. Also contains obsolete Planner paths. |
| `Documentation/index.md` | Legacy/redesign routing | Repository documentation; protected local change | Correctly labels old pages legacy, but the reevaluation report must become the continuation entry. |
| `Documentation/architecture.md` | Original Copilot architecture | Legacy and stale | Describes `.github` as canonical and Markdown hooks as automatic; contradicted by `.ai` authority and current hook reality. |
| `Documentation/instructions.md` | Copilot instruction mechanics | Legacy and stale | Inventory and `.instructions.md` assumptions do not match the folder symlink behavior. |
| `Documentation/skills.md` | Old skill inventory | Legacy and incomplete | Lists only a subset, treats colocated evals as runtime skill content, and points authors to adapters. |
| `Documentation/agents.md`, `orchestrator.md` | Old agent roster/orchestration | Legacy | Agent names, paths, and workflow assumptions require ownership classification. |
| `Documentation/instructions-vs-skills.md` | Rule-vs-workflow distinction | Conceptually current | Preserve principle, update locations and distribution semantics. |
| `Documentation/verify-markdown.sh` | Docs lint/link gate | Repository tooling | Covers `Documentation/**/*.md`, not root handovers/reports; it invokes unpinned `npx` tools. |

### 3.3 Redesign proposal set

| Path | Purpose | Status after reevaluation |
| --- | --- | --- |
| `AI-REPOSITORY-REDESIGN-HANDOVER.md` | Original comprehensive target | **Superseded as implementation authority.** Retain as a decision history/proposal. |
| `AI-REPOSITORY-REDESIGN-NEXT-SESSION-HANDOVER.md` | Deferred PR-2 handover | Superseded by this report and the revised prompt. |
| `AI-REPOSITORY-REDESIGN-REEVALUATION-PROMPT.md` | This session’s audit contract | Completed input record; do not use as the next implementation prompt. |
| `Documentation/public-product-architecture.md` | PR-1 ownership ADR | Sound principles, but co-location/native distribution/project-context claims are proposals pending Workflows#68. |
| `Documentation/phase-0-verification.md` | First-session evidence | Historical evidence; correct npm and local CLI facts, incomplete ecosystem inventory. |
| `Documentation/skill-classification-audit.md` | Initial 43-skill audit | Still materially valid, with updated details in section 8 below. |
| `catalog/public-skills.yml` | Source-oriented candidate allowlist | Useful inventory, not an enforceable artifact model. |
| `catalog/product-coverage.yml` | Roadmap/claim inventory | Useful gap map, but “verified-only” claims are not bound to evidence. |
| `catalog/ecosystem-versions.json` | Version-sensitive evidence registry | Updated in this reevaluation for current official facts; schema remains too prose-oriented. |
| `catalog/schemas/*.json` | Closed catalog schemas | Shape checks work, but split/merge/approval/evidence models are insufficient. |
| `tooling/catalog-validation.mjs` and specs | Dependency-free validation | Current scaffold; strict parsing fixed here. It still is not a standards-complete JSON Schema or artifact validator. |

### 3.4 Current artifact inventory

Current tracked top-level counts are `.ai` 185, `.claude` 57, `.pi` 33, `.github` 25, and `Documentation` 8, plus root adapters and metadata.

| Artifact | Current source and count | Adapters/derived surfaces | Target owner |
| --- | --- | --- | --- |
| Rules | `.ai/rules`: 35 files | `.claude/rules`, `.github/instructions`, root instruction adapters | Engineering policy; extract only workflow-required facts into public skills. |
| Agents | `.ai/agents`: 12 | `.github/agents`, `.claude/agents`, `.pi/agents` | Engineering, except Ensemble/Stagehand-specific behavior belongs to those products. |
| Prompts | `.ai/prompts`: 18 | `.github/prompts`, `.claude/commands`, `.pi/prompts` | Engineering native packages where supported. |
| Hooks | `.ai/hooks`: 2 guidance files, README, 11 script/data files | `.pi/extensions/cratis-hooks`; no tracked `.claude/settings.json`; no tracked Copilot hook config | Engineering executable boundary; host-specific and opt-in. |
| Workflows | `.ai/workflows`: 1; `.github/workflows`: 4 | Reusable Workflows repository plus local wrappers | Organization mechanics belong to Workflows; package/release workflows remain repository tooling. |
| Skills | 43 direct directories, 104 files | Folder adapters into Claude, Copilot, Codex; Pi package discovery | 35 public source candidates, 8 engineering sources; public runtime approval remains zero. |
| Skill resources | 13 `references/`, 13 `evals/`, 1 `scripts/`, 1 `assets/`, 1 license | `skill-creator` holds all executable skill scripts and vendored license | Public references may migrate; public evals move out; scripts stay engineering-only. |
| Pi extensions | `cratis-hooks` and `subagent` (3 TypeScript files) | Executable Pi behavior | Engineering; full-system-access package, never passive `@cratis/ai`. |
| Propagation | local wrappers and scripts plus Workflows reusable workflows | Direct default-branch fan-out | Frozen legacy; Workflows#68 owns replacement and rollback. |
| Legacy docs | 7 conceptual pages plus verifier | Human explanation | Update or archive after replacement, never silently leave as target docs. |
| Catalog/tooling | 3 catalogs, 3 schemas, 3 validation/spec files | No runtime package | Repository-only authoring and release gate. |

Tracked adapters include 100+ symlinked/path-reference surfaces. A release artifact should reject all symlinks even though Agent Plugins permits internal resolved symlinks, because NanoClaw and other clients may be stricter and Windows materialization is inconsistent.

## 4. Official ecosystem findings

The authoritative details and verification dates are recorded in `catalog/ecosystem-versions.json`. Material changes from the prior handover are:

- Agent Plugins remains **1.0.0**, but the live registry now lists **nine** clients: VS Code, Cursor, GitHub Copilot, ChatGPT/Codex, Kiro, Hermes Agent, OpenClaw, Grok Bot, and NanoClaw.
- MCP’s current specification is **2026-07-28**. The prior catalog had no MCP record.
- `gh skill` remains preview. Its current install target list is broader, but does not include Zed, DeepSeek Harness, Hermes Agent, OpenClaw, or NanoClaw. Local GitHub CLI 2.71.2 still lacks the command.
- VS Code consumes Agent Plugins and supports Copilot-specific extension data under `com.github.copilot`.
- Claude now documents a reviewed public **community marketplace** and submission forms; the earlier “if open” wording is stale.
- Copilot’s current CLI reference documents self-hosted marketplaces and built-in marketplaces, but not the handover’s claimed external-plugin issue workflow.
- OpenAI’s public directory uses interactive organization/identity review and requires five positive plus three negative tests. Native plugins may also contain hooks, but public listing remains skills/MCP focused.
- Gemini extensions now document skills, commands, hooks, subagents, policies, context, settings, themes, and MCP.
- Cursor supports user/project installs and paid managed team marketplaces; public plugins and updates are manually reviewed.
- Pi 0.84.2 is both installed and current. Passive packages natively carry skills, prompts, extensions, and themes; persistent rules, agents, MCP, and LSP require other mechanisms or executable extensions.
- Junie’s repository documents extension structure but no general third-party submission or update mechanism.
- npm trusted publishing currently requires Node 22.14+, npm 11.5.1+, GitHub-hosted runners, and `id-token: write`. Local Node 23.11.1 qualifies; npm 10.9.2 does not.

Key official sources:

- [Agent Plugins specification](https://agent-plugins.org/specification), [schemas](https://agent-plugins.org/schemas), and [clients](https://agent-plugins.org/compatible-clients)
- [Agent Skills specification](https://agentskills.io/specification)
- [MCP specification](https://modelcontextprotocol.io/specification) and [Registry](https://modelcontextprotocol.io/registry/about)
- [`gh skill`](https://cli.github.com/manual/gh_skill)
- [VS Code Agent Plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
- [Copilot plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [OpenAI plugin build](https://developers.openai.com/codex/plugins/build) and [submission](https://developers.openai.com/plugins/deploy/submission)
- [Claude plugins](https://code.claude.com/docs/en/plugins) and [marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Gemini extension reference](https://geminicli.com/docs/extensions/reference/) and [release guide](https://geminicli.com/docs/extensions/releasing/)
- [Cursor plugins](https://cursor.com/docs/plugins)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)

## 5. Agent Plugin conformance assessment

| Finding | Verdict | Evidence/consequence |
| --- | --- | --- |
| Root `plugin.json` with the 1.0.0 schema | **Conformant when materialized** | Required fields are `$schema` and `name`; `cratis` is a valid name. No manifest exists yet. |
| Root immediate-child `skills/*/SKILL.md` | **Conformant target** | Fixed path; skills must strictly satisfy Agent Skills and name-directory parity. |
| Optional root `mcp.json` | **Conformant only when a real server exists** | Closed schema; version must match plugin; no need to create it now. |
| Unknown manifest fields | **Nonconformant but nonfatal per spec** | Clients report and ignore unknown top-level fields; client data belongs in `extensions`. |
| Extra source directories beside a plugin | **Spec-tolerated, policy-nonconformant** | Core discovery ignores unrelated directories, but a direct source install materializes content forbidden by Cratis’s proposed runtime boundary. |
| Co-located `engineering/skills` plus `gh skill --all` | **Nonconformant with the product boundary** | `gh skill` recursively discovers standard skill paths and does not consult the catalog. |
| Positive-allowlist release archive/npm tarball | **Potentially conformant** | Must be built into a new empty directory, enumerate exact files, reject symlinks/escapes, unpack, and revalidate. None of that exists yet. |
| Symlinks | **Unknown across all clients; reject in releases** | Agent Plugins allows internal resolved symlinks; NanoClaw rejects all. A lowest-common-denominator artifact should contain none. |
| Client-specific wrappers | **Unknown until generated and smoke-tested** | Native manifests can expose the same public skills/MCP, but richer native fields must not change behavior. |
| Direct repository installation | **Do not support from the mixed source branch** | It bypasses artifact allowlisting and may expose non-public source. Use an accepted public-only ref/archive/package. |
| Version parity and immutable sources | **Feasible, not implemented** | One passive-product version can generate wrappers; executable MCP/Pi packages version separately. Release assets should use immutable releases and checksums/attestations. |
| `@cratis/ai` as npm/Pi package and Agent Plugin | **Technically possible, UX-sensitive** | `package.json` drives Pi while `plugin.json` drives Agent Plugins. Documentation must name each installer and make the package passive; no install lifecycle scripts. |
| `@cratis/mcp` and `@cratis/pi` separation | **Sound** | Executable trust differs materially from passive skills. Keep separate. |

## 6. Harness capability and installation matrix

Legend: **Y** native, **P** portable Agent Plugin, **E** possible only through executable/plugin extension, **—** not documented, **M** managed/organization capability.

| Harness | Skills | Persistent rules/context | Agents | Commands | Hooks | MCP | LSP | Scope/update | Project-context discovery |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VS Code/Copilot | P/Y | `AGENTS.md`, Copilot instructions; native extension rules | Y | Y | Y | P/Y | Y | user/workspace; marketplace/update checks | No `.cratis` convention; root `AGENTS.md` can bootstrap. |
| Copilot CLI | P/Y | `AGENTS.md`; no native plugin instruction component documented | Y | Y | Y | P/Y | Y | plugin user scope; individual skills user/project; update command | Root/nested `AGENTS.md`; arbitrary path needs bootstrap. |
| Cursor | P/Y | user/team/project rules and `AGENTS.md` | Y | Y | Y | P/Y | — | user/project; team managed paid; reviewed updates | `AGENTS.md` works; `.cratis` needs explicit reference/bootstrap. |
| ChatGPT/Codex | P/Y | global/project `AGENTS.md`; config | subagents native, not plugin component | — | Y | P/Y | — | repo/personal/workspace/public directory; reviewed versions | Root `AGENTS.md`; arbitrary path not automatic. |
| Claude Code | Y | managed/user/project `CLAUDE.md` | Y | Y | Y | Y | Y | user/project/local/managed; marketplace auto-update policy | `CLAUDE.md` can `@.cratis/PROJECT.md`; plugin alone is insufficient. |
| Gemini CLI | Y | global/workspace `GEMINI.md`; extension context | Y | Y | Y | Y | — | global install; user/workspace enable; release/branch updates | Root `GEMINI.md` or configured context name/import required. |
| Pi | Y | global/project `AGENTS.md`/`CLAUDE.md`; E injection | custom agents are repository extension behavior, not package resource | prompt templates/E | E | E, no built-in MCP | E | npm/Git user/project, trust-gated, pin/update | Root `AGENTS.md` or `CLAUDE.md`; `.cratis` needs bootstrap/extension. |
| Kiro | P/Y | Kiro-native steering outside portable core | — | — | — | P/Y | — | marketplace/Git/local; remote refresh | No verified `.cratis` discovery. |
| Hermes Agent | P/Y | plugin instructions | — | — | — | P (no legacy SSE) | — | install then explicit enable | No verified project-context convention. |
| OpenClaw | P/Y | native bundle config outside portable core | — | native richer format | native richer format | P/Y | — | directory/archive/marketplace | No verified `.cratis` discovery. |
| Grok Bot | P/Y | saved skills/bot context | — | routines | routines | P per registry | — | Settings/plugins; per-bot enable | Undocumented. |
| NanoClaw | P/Y | persona/context extension data | — | tasks | script gates in container | P (no legacy SSE) | — | local stamp/restamp | Extra context must be explicitly referenced. |
| Junie | Y | guidelines | Y | — | — | Y | — | public third-party mechanism undocumented | No verified `.cratis` discovery. |
| OpenCode | Y | AGENTS/config/remote/managed instructions | Y | Y | plugin hooks | Y | Y | global/project/org/managed; package auto-update | Global/project config can explicitly include `.cratis/PROJECT.md`. |
| Zed | Y | Zed instructions outside skill mechanism | profiles | — | — | Y | editor-native | user/project; live reload; no native `gh skill` target | `.agents/skills` only for skills; no `.cratis` convention. |
| DeepSeek Harness | Y, preview | provider/config dependent | agent presets | — | plugin system | provider/plugin dependent | — | developer-preview provider model | `.dsh/skills`/`.agents/skills`; no `.cratis` convention. |

### Parity conclusion

Portable parity is possible only for **public skills and MCP**. Engineering parity is not. The smallest safe fallback is host-specific installation plus project-owned bootstrap files, not pretending unsupported component types exist.

## 7. Public artifact and supply-chain threat review

| Threat | Risk | Required control |
| --- | --- | --- |
| Engineering skill discovery through `--all` | Internal/operational workflows enter a public install | Never publish from mixed source; avoid `engineering/**/skills`; test recursive discovery against staging. |
| Working-tree subtraction packaging | New forbidden paths ship silently | Build from an empty directory using exact positive selections. |
| Symlink/path traversal | Files escape source or archive root; inconsistent clients | `lstat` every entry; reject all symlinks/special files; `realpath` containment; verify archive entries before extraction. |
| Hidden/native wrappers drift | One client receives different behavior | Generate wrappers from one target catalog and compare skill/MCP inventories byte-for-byte. |
| Mutable branch/tag marketplace source | Silent supply-chain replacement | Pin full commit SHA, immutable npm version, or immutable release asset SHA-256; no moving branches for releases. |
| npm lifecycle execution | Passive package executes code on install | No install lifecycle scripts; use `files` allowlist; inspect and unpack `npm pack --json`. |
| Skill prompt injection/destructive instructions | Installed Markdown can drive tools | Narrow triggers, explicit confirmations, security review, positive/negative behavior evals; high-risk operations remain engineering or separately reviewed. |
| Executable hooks/MCP/Pi extensions | Full user/system access | Separate packages, opt-in trust, least privilege, bounded output/timeouts, no embedded secrets, dedicated security review. |
| Secrets/private URLs in references or metadata | Public disclosure | Secret scan source and staged artifact; reject private hosts, local absolute paths, credentials, and personal data. |
| Auto-update without review | Compromised update reaches users | Pin for CI/managed installs; publish changelog/checksum/attestation; require reviewed release workflow. |
| Registry/marketplace trust overstatement | Namespace/review mistaken for code safety | State what each review verifies; provenance links source/build but does not prove benign behavior. |

## 8. Complete 43-skill reevaluation

All 43 direct directories contain `SKILL.md` and currently match frontmatter names. Classification remains **35 public source candidates and 8 engineering sources**. The proposed business-rule split and gated vertical-slice merge would yield 35 public target capabilities if evaluations approve both. No public target is approved for runtime inclusion.

The current 13 eval-bearing skills contain 27 behavior cases. There are **zero dedicated positive/negative trigger suites**. Eleven public candidates contain colocated evals; `skill-creator` contains the only skill scripts and its Apache-2.0 bundle.

| Current skill | Owner and target | Trigger / near miss | Decision, blocker, risk, and remediation |
| --- | --- | --- | --- |
| `add-business-rule` | Public → `cratis-arc-command-validation` + `cratis-chronicle-event-constraints` | Existing-command validation/uniqueness; not command creation/spec writing | Split. Separate pre-handler/state checks from append-time constraints; concurrency integrity risk; split evals and add collision negatives. |
| `add-concept` | Public → `cratis-fundamentals-concept` | Strongly typed values/identities; not DTO cleanup or event migration | Retain/rename; add `ConceptAs<T>` vs `EventSourceId<T>` behavior and negatives. |
| `add-ef-migration` | Public → `cratis-arc-ef-core-migration` | EF schema change; not Chronicle read model/paging | Retain; remove rule dependency; high destructive schema risk; add data/rollback/wrong-store cases. |
| `add-projection` | Public → `cratis-chronicle-projection` | Add projection; not create read model/reducer/reactor | Retain; bundle filtering reference; model-bound/AutoMap-first; add collision tests. |
| `add-reactor` | Public → `cratis-chronicle-reactor` | Automation/translation; not projection or ordinary pipeline call | Retain; bundle reactor invariants; replay/side-effect risk; test idempotency. |
| `add-reducer` | Public → `cratis-chronicle-reducer` | Genuine reducer admission; not simple projection | Retain projection-first/reducer-last; remove rule dependencies; add simple-mapping negatives. |
| `auth-and-identity` | Public → `cratis-arc-authentication-authorization-and-identity` | Arc authn/authz/identity; not isolated validation or tenancy | Retain broad for now; remove generated-instruction dependency; high security risk; split only if trigger evidence supports it. |
| `call-command-from-code` | Public → `cratis-arc-command-execution` | Execute existing command in backend; not define one | Retain; distinguish cross-stream event return; replay/side-effect tests. |
| `cratis-command` | Public → `cratis-arc-command` | Define command/full-stack proxy use; not rule-only or pipeline execution | Retain; route to split validation/constraints; remove legacy rule dependency. |
| `cratis-react-page` | Public → `cratis-arc-react-page` | DataPage/MVVM page; not empty shell/wizard/toolbar | Retain; body/references/evals disagree on APIs; version-verify and reconcile before migration. |
| `cratis-readmodel` | Public → `cratis-chronicle-read-model` | Create read model/query; not projection/reducer-only | Retain; correct identity typing and reducer overuse; bundle filtering docs. |
| `cratis-specs-csharp` | Public → `cratis-specifications-csharp` | Framework/library C# BDD; not application scenarios | Retain/narrow; bundle universal conventions; add application negatives. |
| `cratis-specs-typescript` | Public → `cratis-specifications-typescript` | Framework/package TS BDD; not React slice behavior | Retain/narrow; move evals and add React negatives. |
| `cratis-vertical-slice` | Public → `cratis-application-vertical-slice` | Slice architecture/type selection; near full implementation | Gated merge with `new-vertical-slice`; current examples/build/spec ordering stale; require architecture-vs-implementation trigger tests. |
| `create-event-model` | Public → `cratis-event-model-diagram` | Maintain Mermaid diagram; not settle event vocabulary | Retain; update cross-skill names and add modeling negatives. |
| `cross-cutting-properties` | Public → `cratis-chronicle-event-metadata` | Envelope audit/correlation metadata; not domain payload/tenant isolation | Retain; privacy/PII risk; add secrets and payload negatives. |
| `diagnose-slice` | Public → `cratis-application-slice-diagnostics` | Source symptom routing; not live-store/HTTP operation | Retain but make self-contained; add operation/HTTP collision tests. |
| `discover-implementations` | Public → `cratis-fundamentals-type-discovery` | Enumerate interface implementations; not normal single-service DI | Retain; add discovery behavior and DI negatives. |
| `event-modeling` | Public → `cratis-chronicle-event-modeling` | Unsettled domain/stream design; not diagram editing or implementation | Retain; remove engineering `ship-changes` edge; add settled-model negatives. |
| `event-type-migrations` | Public → `cratis-chronicle-event-type-migration` | Stored event schema evolution; not new event/EF migration | Retain; make `generation:` the explicit exception; high replay risk; old-event tests. |
| `inspect-running-chronicle` | Public → `cratis-chronicle-cli-operations` | Live store state; not source diagnosis | Retain only after separating read-only and mutating flows; high production risk; explicit target/confirmation/`--yes` negatives. |
| `multi-tenancy` | Public → `cratis-chronicle-multi-tenancy` | Namespace isolation; not identity or metadata alone | Retain; high isolation risk; cross-tenant behavior and non-multitenant negatives. |
| `new-vertical-slice` | Public → merged `cratis-application-vertical-slice` | End-to-end slice; near architecture explanation/feature shell | Gated merge; remove hard-coded docs gate and stale component APIs; reconcile workflow, do not concatenate. |
| `observable-query-curl` | Public → `cratis-arc-observable-query-http` | HTTP/SSE debugging; not frontend implementation/live store | Retain; add auth/snapshot/stream behavior and negatives. |
| `query-paging` | Public → `cratis-arc-query-paging` | Server paging/sorting; not generic query/performance audit | Retain as authoritative paging guidance; correct performance-review conflict. |
| `review-code` | Public → `cratis-code-review` | General Cratis review; not dedicated security/performance | Retain; remove duplicated specialist performance ownership and reconcile barrel policy. |
| `review-performance` | Public → `cratis-performance-review` | Focused scalability review; not implementation request | Retain separate; fix manual paging and in-memory-only validator claims; add evidence-based behavior tests. |
| `review-security` | Public → `cratis-security-review` | Focused Cratis security review; not auth implementation/full generic audit | Retain; fix absolute ID/cookie claims; high false-positive/classification risk. |
| `scaffold-feature` | Public → `cratis-arc-react-feature-scaffolding` | Empty route/nav/page shell; not a behavior slice/DataPage | Retain; resolve barrel conflict and add slice/page negatives. |
| `stepper-command-dialog` | Public → `cratis-components-stepper-command-dialog` | Multi-step command wizard; not ordinary dialog | Retain; version-verify API; test validation/navigation. |
| `toolbar` | Public → `cratis-components-toolbar` | Canvas/tool icon controls; not ordinary page actions | Retain; bundle import facts and add page-menu negatives. |
| `write-specs` | Public → `cratis-application-slice-specifications` | Application backend scenario router; not framework/focused specs | Retain/narrow; bundle routing contracts and collision suite. |
| `write-specs-events` | Public → `cratis-chronicle-event-specifications` | Raw append/constraint/concurrency specs; not command/read model | Retain; add behavior and negatives. |
| `write-specs-frontend` | Public → `cratis-application-react-specifications` | React application behavior; not framework package TS specs | Retain; bundle essentials and add framework negatives. |
| `write-specs-readmodels` | Public → `cratis-chronicle-read-model-specifications` | Projection/reducer scenario specs; not read-model creation/raw append | Retain; add sequence behavior and collision tests. |
| `add-cratis-docs-page` | Engineering → `cratis-engineering-docs-add-page` | New product docs page; not edit/QA | Retain engineering; multi-repo/TOC workflow; wrong-owner/generated-copy negatives. |
| `add-traces` | Engineering → `cratis-engineering-chronicle-kernel-tracing` | Chronicle Kernel contributor tracing; not app telemetry | Engineering classification confirmed by transient kernel/package maintenance details; version-verify and add generic-OTel negatives. |
| `cratis-csharp-standards` | Engineering → `cratis-engineering-csharp-conventions` | Cratis house C# policy; not task workflow | Engineering classification confirmed; add event-generation exception and avoid exporting repository-target language assumptions. |
| `edit-cratis-docs` | Engineering → `cratis-engineering-docs-edit-page` | Edit source-owned docs; not create/visual QA | Retain engineering; prevent generated-copy edits; sibling-repo workflow. |
| `qa-cratis-docs` | Engineering → `cratis-engineering-docs-visual-qa` | Light/dark rendered QA; not textual review | Keep separate; executable browser/dev-server infrastructure and lifecycle controls. |
| `ship-changes` | Engineering → `cratis-engineering-ship-changes` | Explicit commit/push/PR/merge request; not review/status | Retain engineering; high remote/destructive risk; preserve history/CI/permission safeguards and add refusal tests. |
| `skill-creator` | Engineering → `skill-creator` | Skill authoring/evaluation; not ordinary prompt edit | Keep upstream name and complete Apache bundle; only skill with scripts; isolate Cratis wrapper and test subprocess safety. |
| `write-documentation` | Engineering → `cratis-engineering-docs-authoring` | Diátaxis authoring; not placement/edit/visual QA | Retain as shared authoring/router guidance; keep visual QA separate. |

### Skill decisions that remain valid

- `add-traces` and broad C# conventions remain engineering-owned.
- Split `add-business-rule` into independent Arc and Chronicle capabilities.
- Keep focused performance review, after removing duplicates and contradictions.
- Keep semantic `cratis-` names and improve every skill rather than mechanically rename.
- Keep vertical-slice consolidation as a **gated experiment**, not an approved merge.

## 9. Engineering corpus and propagation alternatives

Scores: 1 poor, 5 strong. “Boundary” means preventing engineering content from entering the public runtime.

| Alternative | Compatibility | Boundary | Project context | Update/rollback | Maintenance | Security | UX | Total / 35 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1. Co-located source and direct root plugin | 3 | 1 | 3 | 3 | 4 | 2 | 4 | 20 |
| 2. Separate public product and engineering repositories | 5 | 5 | 3 | 4 | 3 | 5 | 4 | 29 |
| 3. No shared engineering corpus | 2 | 5 | 2 | 2 | 2 | 4 | 2 | 19 |
| 4. Minimal co-located engineering native packages, no propagation | 3 | 4 | 3 | 4 | 3 | 3 | 3 | 23 |
| 5. **One canonical source plus generated public-only release tree/ref** | 5 | 5 | 4 | 5 | 4 | 4 | 4 | **31** |

### Recommended alternative

Alternative 5 best reconciles the maintainer preference for one source repository with strict public artifacts:

- `main` remains the canonical corpus source;
- public skills live under a source path selected by the catalog;
- engineering Agent Skills use a non-auto-discovered path such as `engineering/capabilities/`;
- a clean release worktree contains only public `plugin.json`, `skills/`, approved native wrappers, and public docs/licenses;
- `gh skill publish`, marketplace checks, and package creation run only in that worktree;
- an immutable release commit/tag/archive and npm tarball are the installable products;
- Workflows owns canary, rollout, pinning, rollback, and any residual bootstrap migration.

This recommendation still requires explicit maintainer acceptance under Workflows#68. If a public-only release ref cannot satisfy Cursor, Gemini, Kiro, and other Git-root marketplace pilots without exposing source-only content, choose alternative 2 rather than weaken the boundary.

Broad all-to-all propagation remains unnecessary for public skills and most native packages. A controlled one-time migration or project PR may still be required for project-owned bootstrap files and package pins.

## 10. `.cratis/PROJECT.md` viability

**Conclusion:** retain `.cratis/PROJECT.md` as the canonical project-local content source, but stop calling it a discoverable harness-neutral instruction file.

Smallest safe fallback:

- root `AGENTS.md` for Copilot, Codex, Cursor, OpenCode, and Pi;
- root `CLAUDE.md` with `@.cratis/PROJECT.md` for Claude;
- root `GEMINI.md` with the corresponding import for Gemini;
- explicit native user/managed configuration may eliminate a bootstrap in a controlled organization install;
- all bootstrap files are project-owned, minimal, and never overwritten by corpus distribution.

During migration, installed guidance may read both `.cratis/PROJECT.md` and legacy `.agents/PROJECT.md`, with `.cratis` authoritative. Do not remove the legacy path fleet-wide until one application and one framework pilot prove every supported harness discovers the replacement.

This satisfies the actual maintainer goal: shared content leaves `.claude/`, `.agents/`, and Copilot-specific folders, while project-owned configuration remains allowed. It does not promise zero project bootstrap files.

## 11. Catalog, schema, and validator assessment

### Strengths

- default policy is `deny`;
- all 43 current skill sources are accounted for exactly once;
- all public entries remain candidates with `includeInRuntime: false`;
- modeled schema objects reject unknown properties;
- current catalogs parse as strict JSON;
- existing semantic checks catch inventory, naming, duplicate merge group, and unsafe approval basics.

### Blocking gaps

1. `sources`, public `targets`, and `migrations` need separate collections. Split targets and merged output need independent dependencies, evaluations, security status, approval, revision, digest, and runtime inclusion.
2. Approval needs reviewer/date/evidence/security/revision/content digest, not only `candidate|approved|rejected`.
3. Every fact and product claim needs direct evidence IDs, applicable versions, verification/expiry, and confidence; parallel prose arrays are insufficient.
4. Coverage state and released support claim must be distinct.
5. The validator must build and verify an exact staged artifact. Catalog wildcard prose is not enforcement.
6. Public payload checks must reject unexpected files, scripts, evals, symlinks, binaries, private links, and path escapes.
7. Native wrapper parity and unpacked npm/archive validation are absent.
8. The custom JSON Schema implementation silently ignores unsupported vocabulary. Use a pinned standards-compliant Draft 2020-12 validator when dependencies are allowed, or fail on unsupported keywords.
9. JSON-compatible YAML remains acceptable only as a temporary no-dependency scaffold. Because it is strict JSON, `.json` is the honest long-term extension unless a real YAML parser is adopted.

### Reevaluation updates applied

- `catalog/ecosystem-versions.json` now records current Agent Plugins clients, MCP 2026-07-28, MCP Registry, VS Code, Kiro, Hermes, OpenClaw, Grok Bot, NanoClaw, OpenCode, Zed, DeepSeek Harness, and npm trusted publishing.
- Catalog parsing now uses strict `JSON.parse` rather than a regex that could mutate commas inside strings.
- Semantic validation now requires the expanded ecosystem records.
- Specs cover strict parsing and the key new ecosystem evidence.

These changes improve evidence accuracy; they do not make the catalog an artifact gate.

## 12. Decision log

### Remain valid

- Public skills/MCP and engineering behavior are separate artifact boundaries.
- Agent Plugins 1.0 is the canonical portable format.
- Use strict positive allowlists and keep passive skills separate from executable MCP/Pi packages.
- No public skill is approved before self-containment, current API review, behavior evals, positive/negative trigger evals, and collision testing.
- `cratis` and the proposed npm names remain sensible, subject to access and trusted-publisher setup.
- Do not rewrite normal history.
- Stagehand and Ensemble retain their documented authority.

### Change or reopen

- **Reopen:** one co-located source repository is still preferred, but direct-root distribution is rejected; use a generated public-only release tree/ref or separate product repository.
- **Change:** do not use `engineering/skills/`; it is recursively discoverable. Use a nonstandard source path and generate native packages.
- **Change:** native engineering installation is a per-host strategy, not one package with parity.
- **Change:** `.cratis/PROJECT.md` needs recognized bootstraps/configuration.
- **Change:** propagation retirement is pending Workflows#68 and pilots.
- **Change:** live client/support lists and marketplace mechanisms must come from the expanded registry, not the original handover.
- **Change:** the repository history already had one approved exceptional rewrite; only further rewrite is prohibited here.

## 13. Revised target tree and artifact boundaries

### Canonical source branch

```text
Cratis/AI (main)
├── README.md
├── public/
│   └── skills/                       # public skill source candidates
├── engineering/
│   ├── capabilities/                 # engineering Agent Skills; deliberately not **/skills
│   ├── rules/
│   ├── agents/
│   ├── prompts/
│   ├── hooks/
│   └── catalog/
├── catalog/
│   ├── sources.json                  # all current inputs
│   ├── public-targets.json           # independently approvable outputs
│   ├── migrations.json               # retain/rename/split/merge/retire graph
│   ├── artifacts.json                # exact artifact definitions
│   ├── product-coverage.json
│   └── ecosystem-versions.json
├── evals/                            # never runtime content
├── tooling/                          # materialize/validate/hash/generate
└── Documentation/
```

Do not create this tree until the catalog v2 and distribution decision are accepted.

### Materialized passive public release

```text
cratis-agent-plugin/
├── plugin.json
├── skills/
│   └── cratis-*/
│       ├── SKILL.md
│       ├── references/
│       ├── assets/
│       └── LICENSE*
├── approved native wrapper metadata  # generated, same skills/MCP only
├── README.md
├── INSTALL.md
├── CHANGELOG.md
└── LICENSE
```

No `engineering`, rules, agents, prompts, commands, hooks, LSP, tooling, evals, workflows, scripts, caches, local configuration, or symlinks.

### Separate executable artifacts

- `@cratis/mcp`: only after a justified, least-privilege tool surface and security review.
- `@cratis/pi`: only for genuine Pi-native executable value, clearly marked full trust.
- Engineering native packages: generated per host and versioned independently from passive `@cratis/ai`.

## 14. Revised phases and pull-request sequence

1. **Decision and evidence correction**
   - accept/defer Workflows#68 distribution;
   - accept generated release-tree/ref or choose a separate product repository;
   - accept project bootstrap strategy and per-host parity limits;
   - keep source unmoved.
2. **Catalog/schema v2**
   - sources, targets, migrations, approvals, claims/evidence, artifacts;
   - strict parser and standards-complete schema validation;
   - complete artifact ownership inventory.
3. **Artifact materializer and adversarial fixtures**
   - empty staging, exact file manifest and SHA-256, no symlinks/escapes;
   - recursive discovery leak fixture;
   - unpacked artifact revalidation.
4. **Engineering ownership reduction in place**
   - classify every rule/agent/prompt/hook/workflow/adapter;
   - no moves until classification is reviewed.
5. **Project-context pilot**
   - one application and one framework repository;
   - root bootstraps plus `.cratis/PROJECT.md` migration;
   - preserve legacy fallback.
6. **Engineering source move**
   - move approved reusable behavior to non-discoverable source paths;
   - preserve protected hook intent and originals until pilot parity.
7. **Public skill family migrations**
   - dependency order; independently approve split outputs; gated merge experiment;
   - behavior/trigger/collision evaluations.
8. **Generated portable release and passive npm/Pi package**
   - plugin artifact and `@cratis/ai`; available-client smoke tests.
9. **Native public wrappers and marketplace pilots**
   - same public inventory only; no behavior fork.
10. **Engineering native installation pilots**
    - host-specific capability matrix; explicit trust and parity gaps.
11. **Supply chain and release**
    - trusted publishing, provenance, immutable releases, checksums/attestations, SBOM where executable.
12. **Controlled rollout and propagation retirement**
    - Workflows-owned canary, pin/update/rollback evidence, wrapper cleanup only after acceptance.

The old PR-2 “engineering ownership reduction” must not resume as written. The next implementation is the decision/catalog/artifact-boundary foundation described in the separate prompt.

## 15. Validation evidence

### Before reevaluation edits

- `.ai/hooks/scripts/validate-ai-setup.sh`: exit 0 with three pre-existing advisory warnings (`.AutoMap()`, `.instructions.md`, and retired `Features/` wording).
- `node tooling/validate-catalogs.mjs`: passed.
- `node --test tooling/specs/catalog-validation.spec.mjs`: 8/8 passed.
- catalog and schema JSON parsing: passed.
- `git diff --check`: passed.
- `gh skill --help`: unavailable on GitHub CLI 2.71.2.
- `npm whoami`: `ENEEDAUTH`.

### Environment evidence

- Node `v23.11.1`;
- npm `10.9.2`;
- GitHub CLI `2.71.2`;
- Copilot CLI `1.0.67`;
- Claude Code `2.1.235`;
- Pi `0.84.2`;
- `skills-ref`, `markdownlint-cli2`, `lychee`, `check-jsonschema`, and `ajv` are not installed as standalone commands.

### Not verified

- No paid client was installed or authenticated.
- No package ownership or trusted-publisher permission was verified.
- No plugin/native manifest validator could validate an artifact because manifest creation was forbidden and no artifact exists.
- Gemini local version validation failed while the CLI attempted to update its local project registry; no Gemini result is claimed.
- Cursor, Kiro, Hermes, OpenClaw, Grok Bot, NanoClaw, Junie, Zed, and DeepSeek Harness were not locally installed.
- Marketplace submission and public listing require human/vendor review and were not attempted.
- Agent audit attempts that failed, aborted, or timed out produced no authoritative repository result and are not cited as completed.

### After reevaluation edits

- `node tooling/validate-catalogs.mjs`: passed for three catalogs and three schemas.
- `node --test tooling/specs/catalog-validation.spec.mjs`: 10/10 passed, including strict parser and current ecosystem regressions.
- strict JSON parsing for the ecosystem catalog and all three schemas: passed.
- primary LSP diagnostics for both changed `.mjs` files: zero diagnostics.
- full session diagnostics over all nine changed report/catalog/tooling files: zero issues; fresh `knip`, `madge`, `jscpd`, `gitleaks`, and `opengrep` runners contributed.
- `.ai/hooks/scripts/validate-ai-setup.sh`: exit 0 with the same three pre-existing advisory warnings and no new warning.
- scoped Markdown lint: zero issues across six changed reports/docs with MD013 disabled for legacy long-form tables and URLs. The default run reported 390 format-only line-length findings plus one heading issue that was corrected; no semantic lint rule remains failing.
- scoped link validation checked 41 links. Forty passed; the unauthenticated crawler received 404 for the private `Cratis/Ensemble#13` URL, which authenticated read-only `gh issue view` had already verified. This is an authentication limitation, not a missing-source claim.
- `git diff --check`: passed for tracked diffs.
- baseline SHA-256 values for the four specifically protected files and `Documentation/index.md` remained unchanged.

## 16. Canonical next-session handover

Start with the canonical continuation set, not either prior handover:

- [`AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md`](./AI-REPOSITORY-REDESIGN-CONTINUATION-HANDOVER.md);
- [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PLAN.md);
- [`AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md`](./AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md).

## 17. Precise next implementation prompt

```text
Read AI-REPOSITORY-REDESIGN-REEVALUATION.md completely and execute
AI-REPOSITORY-REDESIGN-IMPLEMENTATION-PROMPT.md exactly.

Do not resume the old PR-2. The next scope is the replacement decision,
catalog/schema v2, complete ownership inventory, and public-artifact
materializer foundation. Do not move skills or engineering source and do not
create plugin/package manifests until the distribution decision is explicitly
accepted and recorded.
```
