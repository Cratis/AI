# Cratis.AI

This repository is two things sharing one source of truth:

- **`Cratis.AI`** (NuGet) - the backend: AI providers, pools, tiers, concurrency, conversations,
  agents, worker/harness scheduling, and usage. Consumed today by `Direct` and `Studio`, which each
  grew an overlapping, diverging AI stack independently before this consolidation.
- **`@cratis/ai`** (npm) - the generated Arc command/query proxies and TypeScript types for
  everything `Cratis.AI` exposes over HTTP, published from the same release as the NuGet package.

It also carries a separate, parallel effort - the TypeScript corpus/profile-distribution content
under `Source/Harness.Setup`, `Source/Pi.Plugin`, `Source/Verification` and `.cratis/ai/` - which
this documentation does not cover. See that content's own `AGENTS.md`/`CLAUDE.md` and
`AIConsolidation.md` at the repository root.

## Where to start

- [`architecture.md`](./architecture.md) - the layered design: what each folder under
  `Source/Cratis.AI/` owns, and the seams between them.
- [`abstractions.md`](./abstractions.md) - the seams a consumer implements to adopt the package
  (`ISecretProtector`, `IAIAgents`, `IAgentExecution`, `AddCratisAI()`), including the ordering
  rule that makes Chronicle's type discovery actually see the package.
- [`anthropic-credentials.md`](./anthropic-credentials.md) - credential normalization and authentication headers.
- [`usage.md`](./usage.md) - the usage subsystem: concepts, `AgentSessionUsageRecorded`, the
  command, the read models, and how event-type changes are handled without migrations.
- [`migration-status.md`](./migration-status.md) - a living record of what has moved from Direct
  and Studio into the package, what has not, and what each still-open PR contains. Read this first
  if you are picking this work up mid-stream.
- [`decisions/`](./decisions/) - architecture decision records. Each documents the context, the
  decision, its consequences, and the alternatives that were rejected - read these before
  revisiting a decision that looks wrong; the reasoning for it is here, not only in the code.

## The source document

The full consolidation plan, including the investigation findings behind every decision referenced
throughout this documentation, lives outside this repository at
`/Volumes/Code/Cratis/ai-consolidation-plan.md` (donor repositories: `Cratis/Direct` and
`Cratis/Studio`; scaffolding reference: `Cratis/Arc` and `Cratis/Chronicle`). Section numbers cited
throughout this `Documentation/` folder (e.g. "plan Section 5.3b") refer to that document.
