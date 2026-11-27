# Cratis.AI

This repository is two things sharing one source of truth:

- **`Cratis.AI`** (NuGet) - the backend: AI providers, pools, tiers, concurrency, conversations,
  agents, worker/harness scheduling, and usage. Consumed today by `Direct` and `Studio`, which each
  grew an overlapping, diverging AI stack independently before this consolidation.
- **`@cratis/ai`** (npm) - the generated Arc command/query proxies and TypeScript types for
  everything `Cratis.AI` exposes over HTTP, published from the same release as the NuGet package.

It also carries the Cratis AI corpus under `.cratis/ai/` - the skills and rules coding agents use when
building with or contributing to Cratis - and the tooling that installs and checks it. Start with
[Installing and using the corpus](./corpus-installation.md).

## Where to start

- [`backend-quick-start.md`](./backend-quick-start.md) - from an empty application to a first chat
  response: what a `LanguageModelPurpose` is, how it maps to a provider and model, and one
  complete example.
- [`architecture.md`](./architecture.md) - the layered design: what each folder under
  `Source/Cratis.AI/` owns, and the seams between them.
- [`abstractions.md`](./abstractions.md) - the seams a consumer implements to adopt the package
  (`IAIAgents`, `IAgentExecution`, `AddCratisAI()`), including the ordering
  rule that makes Chronicle's type discovery actually see the package.
- [`decision-making.md`](./decision-making.md) - the decision capability: context plus a finite set
  of choices in, a probability distribution out, with no generation and no thresholds. Covers the
  capability enums, the resolver seam, and the Decision Engine service under `Source/DecisionEngine/`.
- [`anthropic-credentials.md`](./anthropic-credentials.md) - credential normalization and authentication headers.
- [`worker-console.md`](./worker-console.md) - console readiness, cancellation, and application-owned archiving.
- [Kubernetes worker scheduling](./worker-scheduling.md) - batch packing and running-worker eviction protection.
- [`provider-harnesses.md`](./provider-harnesses.md) - select supported worker harnesses per provider and migrate away from per-agent selection.
- [`agent-configuration.md`](./agent-configuration.md) - the separate agent role and assignment events, `DefineAgent`, and the legacy `ConfigureAgent` path.
- [`provider-administration.md`](./provider-administration.md) - register administrator authorization for AI management.
- [`provider-team-members.md`](./provider-team-members.md) - restrict a provider to specific team
  members, and what enforcing that selection during dispatch is left to the consumer.
- [`provider-capacity.md`](./provider-capacity.md) - how much of each provider's subscription
  windows is left, how pools rank and skip members by it, and how long a hit limit stays parked.
- [`reverse-proxy.md`](./reverse-proxy.md) - `Cratis.AI.ReverseProxy`: expose models served by other machines
  over the OpenAI and Claude protocols with YARP, routed by model name over a pluggable transport.
- [`usage.md`](./usage.md) - the usage subsystem: concepts, `AgentSessionUsageRecorded`, the
  command, the read models, and how event-type changes are handled without migrations.
- [`migration-status.md`](./migration-status.md) - a living record of what has moved from Direct
  and Studio into the package, what has not, and what each still-open PR contains. Read this first
  if you are picking this work up mid-stream.
- [`corpus-installation.md`](./corpus-installation.md) - choose a profile, install the corpus with the Cratis CLI or as a
  harness plugin, and what a session then sees.
- [`corpus-migration.md`](./corpus-migration.md) - what changed when the corpus became task-based, what was removed, and
  what every earlier profile ID installs now.
- [`authoring-skills.md`](./authoring-skills.md) - the checklist a new or changed skill has to meet.
- [`compatibility.md`](./compatibility.md) - the product releases the corpus skills were checked against.
- [`screenplay-session-bundle.md`](./screenplay-session-bundle.md) - the stack-neutral Screenplay guidance
  each release publishes for build loops to inject into coding-agent sessions: format, versions and how
  to consume it.
- [`third-party/tstack.md`](./third-party/tstack.md) - attribution for the tstack review protocol
  concepts an earlier corpus adapted. The adapting skill and rule have been removed; the attribution is kept.
- [`decisions/`](./decisions/) - architecture decision records. Each documents the context, the
  decision, its consequences, and the alternatives that were rejected - read these before
  revisiting a decision that looks wrong; the reasoning for it is here, not only in the code.

## The source document

The full consolidation plan, including the investigation findings behind every decision referenced
throughout this documentation, is an internal planning document that is not published in this
repository (donor repositories: `Cratis/Direct` and `Cratis/Studio`; scaffolding reference:
`Cratis/Arc` and `Cratis/Chronicle`). Section numbers cited throughout this `Documentation/` folder
(e.g. "plan Section 5.3b") refer to that document.
