# Cratis AI documentation

Cratis AI controls shared AI behavior for public Cratis developers and internal
Cratis maintainers, then generates versioned packages for each supported
harness. The mixed source repository is not itself an installation package.

> **Availability:** no supported profile release is published yet. Architecture,
> profile subscriptions, and fixture adapters are implemented; the first narrow
> release still requires approval, production materialization, and a real
> consumer canary.

## Start here

| Page | Purpose |
| --- | --- |
| [Distribution and subscriptions](./ai-distribution-and-subscriptions.md) | Source authority, product profiles, Pi, versioning, pinning, updates, rollback, and upstream improvements |
| [Public product architecture](./public-product-architecture.md) | Public/engineering ownership and runtime payload boundaries |
| [Project context bootstrap](./project-context-bootstrap.md) | Project-owned facts and minimal harness bootstraps |
| [Skill authoring contract](./skill-authoring-contract.md) | Canonical source, evidence, and clean-room requirements |
| [Package and capability catalog](../catalog/generated/human-catalog/CATALOG.md) | Browse public and maintainer packages, included skills, and availability |
| [Capability catalog v2](./capability-catalog-v2.md) | Understand the source, approval, trust, and coverage model behind the generated catalog |
| [Chronicle MCP passive guidance](./chronicle-mcp-guidance.md) | Understand the classification-only Chronicle skill, evidence boundary, and blocked executable lane |
| [Studio MCP passive guidance](./studio-mcp-guidance.md) | Understand the public-safe Studio skill, private-fact boundary, and deny-all operation policy |
| [Native non-skill projections](./native-non-skill-projections.md) | Understand the four repository-only rule/instruction fixture roots and their non-promoting boundary |

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
- `Cratis/AI.Distribution` contains bot-generated immutable artifacts only.
- Repositories pin exact profile versions and update through reviewed pull
  requests.
- Improvements flow upstream through issues or pull requests; generated folders
  are never synchronized bidirectionally.
