# Cratis AI documentation

**Cratis AI is a plugin for your AI coding tool.** It bundles roughly fifty
skills — step-by-step, verified guidance for building on the Cratis ecosystem
(Arc, Chronicle, Fundamentals, Components, and friends). Install it and you're
done: the skills are passive markdown that your assistant loads when a task
matches one. No hooks, no executable code, no MCP server, no background
process.

## Install it

One command block per host. The marketplace source is this repository's
default branch, so what you install is exactly what a reviewer reads here
([Cratis/AI#264](https://github.com/Cratis/AI/issues/264)):

```text
Claude Code:   /plugin marketplace add Cratis/AI
               /plugin install cratis@cratis

Codex:         codex plugin marketplace add Cratis/AI
               codex plugin install cratis@cratis

GitHub Copilot: copilot plugin marketplace add Cratis/AI
                copilot plugin install cratis@cratis

Cursor:        resolves the same skills through its committed
               marketplace manifest — no extra install step.

Pi (npm):      pi install -l npm:@cratis/ai-fundamentals@0.10.0
```

The same marketplace also carries a separate maintainer plugin,
`cratis-engineering`, for people contributing to Cratis' own repositories.

The [harness guide](./harnesses.md) walks every agent harness type — Claude
Code, Codex, GitHub Copilot, Cursor, Pi and npm — with exact install, verify,
and uninstall steps for each, plus the pending hosts (Kiro, Junie, Gemini CLI).

## What you get

- **Passive skills only.** Each skill is a `SKILL.md` (plus references and
  assets). Your assistant auto-loads the matching skill from the task
  description, or you can invoke one explicitly by name.
- **Verified guidance.** Skills are authored against pinned product versions
  in one canonical repository and reviewed there.
- **No lock-in.** Skills never write into your project, never mutate your
  settings, and removing the plugin removes everything they added.

That's all you need. The rest of this page is for when you come back later and
want more than the whole bundle.

## Coming back later? Pick your scenario

| If you are… | Read |
| --- | --- |
| One person with one coding tool | [Solo developer](./scenarios/solo-developer.md) |
| A team sharing one repository | [Team repository](./scenarios/team-repository.md) |
| Using several AI tools on the same repository | [Multiple harnesses](./scenarios/multiple-harnesses.md) |
| A Cratis org contributor | [Cratis maintainer](./scenarios/cratis-maintainer.md) |
| Asking how updates and rollback work | [Updates and rollback](./scenarios/updates-and-rollback.md) |

New words like *profile* or *subscription* are mapped to the plugin vocabulary
you already know in [Concepts](./concepts.md).

## Narrowing the scope (optional)

The plugin carries everything. A repository that wants a narrower scope — one
product, one language, one architecture — records that in a committed
`.cratis/ai.json` and names a profile under the `cratis/` namespace:
`cratis/chronicle/kotlin`, `cratis/arc/csharp`, `cratis/application`, and so
on. The [team repository scenario](./scenarios/team-repository.md) explains
the three-file contract, and the [profile reference](./profile-reference.md)
lists every profile id and its composition.

## For maintainers of Cratis/AI (governance)

The pages below govern the Cratis/AI repository itself. You do not need them
to use Cratis AI.

| Page | Purpose |
| --- | --- |
| [Distribution and subscriptions](./ai-distribution-and-subscriptions.md) | Source authority, product profiles, Pi, versioning, pinning, updates, rollback, and upstream improvements |
| [Maintaining shared AI behavior](./maintaining-shared-ai-behavior.md) | Maintainer workflow for ownership, local overlays, upstream improvements, releases, and one-way delivery |
| [Ecosystem-support architecture review](./ecosystem-support-architecture-review.md) | Idea-level review of what was added, changed, retired, preserved, compatible, and still blocked |
| [Public product architecture](./public-product-architecture.md) | Public/engineering ownership and runtime payload boundaries |
| [Project context bootstrap](./project-context-bootstrap.md) | Project-owned facts and minimal harness bootstraps |
| [Skill authoring contract](./skill-authoring-contract.md) | Canonical source, evidence, and clean-room requirements |
| [Adding or changing a component](./adding-a-component.md) | Re-pin the reviewed digests, anchors and the one count seal when a component's bytes or the corpus size change |
| [Package and capability catalog](../catalog/generated/human-catalog/CATALOG.md) | Browse public and maintainer packages, included skills, and availability |
| [Capability catalog v2](./capability-catalog-v2.md) | Understand the source, approval, trust, and coverage model behind the generated catalog |
| [Chronicle MCP passive guidance](./chronicle-mcp-guidance.md) | Understand the classification-only Chronicle skill, evidence boundary, and blocked executable lane |
| [Studio MCP passive guidance](./studio-mcp-guidance.md) | Understand the public-safe Studio skill, private-fact boundary, and deny-all operation policy |
| [MCP declarations in profiles](./mcp-declarations.md) | Understand how a profile requires an MCP server, and why Studio MCP is an unpublished extension point |
| [Native non-skill projections](./native-non-skill-projections.md) | Understand the four repository-only rule/instruction fixture roots and their non-promoting boundary |
| [Real-host canaries](./real-host-canaries.md) | Understand exact-version isolation, lifecycle phases, blocked outcomes, and non-supporting fixture evidence |
| [S10 release and marketplace gates](./s10-release-and-marketplace-gates.md) | Understand blocked readiness, external controls, append-only records, and unreachable side effects |
| [Maintainer marketplace deployment runbook](./maintainer-marketplace-deployment-runbook.md) | Maintainer-only: every account, credential, protection, and listing that must be configured by hand, and which are still outstanding |

## Repository-local corpus reference

The following pages explain the legacy and repository-local corpus surfaces.
They remain useful for maintainers while content is reconciled into versioned
profiles, but they do not describe a supported installation channel:

| Page | What it covers |
| --- | --- |
| [Architecture overview](./architecture.md) | Existing instructions, skills, agents, prompts, and hooks |
| [Instructions](./instructions.md) | Scoped instruction files and their current adapters |
| [Skills](./skills.md) | Legacy skill inventory and authoring patterns |
| [Agents](./agents.md) | Specialist agents and coordinator patterns |
| [Using the orchestrator](./orchestrator.md) | Repository-local multi-agent coordination |
| [Instructions vs skills](./instructions-vs-skills.md) | Always-on constraints versus on-demand workflows |

## Core rules

- Shared behavior is authored in `Cratis/AI`.
- Product facts remain authoritative in the owning product repository.
- Consuming repositories own `.cratis/PROJECT.md`, `.cratis/ai.json`, and their
  minimal harness bootstraps.
- `Cratis/AI` is installed directly from its default branch. Four committed
  marketplace manifests resolve the real `skills/` and `engineering/`
  directories, so a host installs exactly what a reviewer reads. There is no
  release branch, no `dist/vX.Y.Z` tag, and no generated tree
  ([Cratis/AI#264](https://github.com/Cratis/AI/issues/264)).
- `Cratis/AI.Distribution` receives no further releases and is archived. Its
  already published `v0.1.0` through `v0.3.0` tags stay resolvable and are never
  deleted.
- Improvements flow upstream through issues or pull requests; generated folders
  are never synchronized bidirectionally.

## Status

- **Install today from `main`.** The versioned-release flow — exact-version
  packages, reviewed update pull requests, rollback by version pin — is
  designed but not published yet. Until it ships, the marketplace installs
  straight off the default branch, and the only published package is
  `@cratis/ai-fundamentals` `1.0.0` on npm.
- **Vendor marketplace listing is pending.** Adding `Cratis/AI` as a
  marketplace works now; being *listed* in a vendor's own marketplace UI — so
  strangers can find "cratis" by search — is a separate manual submission per
  host, tracked in
  [Cratis/AI#147](https://github.com/Cratis/AI/issues/147).
- Everything here ships as the supported `1.0.0` release.
