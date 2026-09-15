# Migration status

A living record of where the consolidation actually is, against the plan's suggested PR sequence
(`ai-consolidation-plan.md` Section 10). Update this when a PR in the stack merges or a new one
opens - it is the fastest way for anyone (human or agent) picking this work up mid-stream to know
what exists, what is proven, and what is still assumption.

## PR stack (as of this writing)

All stacked on `main` in order, each individually green (`dotnet build`, `dotnet test`, `yarn ci`,
the corpus's own `yarn verify` self-check):

| PR | Branch | Contains |
|---|---|---|
| #315 | `feat/dotnet-scaffolding` | Phase 1: .NET + yarn workspace scaffolding |
| #316 | `feat/cratis-ai-abstractions` | `Cratis.AI` project + `Abstractions/` seams, agent identity/causation (`IAgentExecution`) |
| #317 | `feat/usage-subsystem` | Usage subsystem: concepts, `AgentSessionUsageRecorded`, `RecordAgentSessionUsage`, read models, decision 0002 |
| #318 | `feat/providers-core` | `ILanguageModel`, `LanguageModelResult`, `ManagedLanguageModel` |
| #319 | `feat/workers-core` | `IWorkerRuntime`, `WorkerJob`, `WorkerRuntimeOptions`, `IKubernetesClientFactory` (interface layer only) |
| #320 | `feat/ci-workflows` | Fixed the yarn-workspace `npm ci` regression in `publish.yml`; added `.NET` build/pack/NuGet-publish |
| #321 | `feat/providers-concepts` | Provider vocabulary: `AIProviderName/Type/ApiKey/Endpoint`, `ModelTier`, `MaxConcurrentJobs`, `Effort` |
| #322 | `feat/root-documentation` | This `Documentation/` folder |
| #323 | `feat/provider-client-seam` | `IAIProviderClient` + the first concrete vendor client (`OpenAICompatible`) |
| #324 | `feat/anthropic-client` | Anthropic vendor client + credential classification |
| #325 | `feat/openai-client` | OpenAI + Azure OpenAI vendor clients + credential classification |
| #326 | `feat/zai-client` | ZAI vendor client (Anthropic-compatible protocol) |
| #327 | `feat/provider-concurrency-gate` | `ProviderConcurrencyGate` + `AIProviderOptions` |

Merge them in order - each is written against the previous one's tip, not against `main` directly.

## What exists and is tested

- Full .NET + yarn scaffolding; the three pre-existing TypeScript projects run as yarn workspace
  members with their own specs green.
- `Abstractions/` seams (`ISecretProtector`/`Revealer`, `IAIAgents`, `IAIAlerts`,
  `IAIUsageAttribution`) with no-op defaults where a safe default exists.
- Agent identity + causation (`Agents/IAgentExecution`/`AgentExecution`/`AgentIdentity`/`AIAgentCausation`) -
  ported and generalized from Direct, closing a gap Studio had entirely. 7 specs.
- The full usage subsystem (concepts, event, command, Trends + Daily read models) - 25 specs.
- `ILanguageModel`/`LanguageModelResult`/`ManagedLanguageModel`, wired onto the above - 9 more specs
  (34 total).
- `IWorkerRuntime`'s contract (no implementation yet) with Direct's incident-derived doc comments
  preserved verbatim.
- Provider vocabulary concepts.
- Five of six vendor clients: `OpenAICompatible`, `Anthropic`, `OpenAI`, `AzureOpenAI`, `ZAI` -
  each a real, working `IAIProviderClient` (plain `HttpClient` + JSON, no vendor SDK dependency),
  sharing `OpenAIChatCompletionsProtocol`/`TransientProviderFailures` where the vendors' wire shape
  actually is the same. Codex is deliberately not among them - see "what does not exist yet" below.
- `ProviderConcurrencyGate` + `AIProviderOptions` - per-provider concurrency bounding, the piece
  the still-to-come resolution layer will wrap every vendor call in.
- `AddCratisAI()` registration with the type-discovery ordering self-check.
- `publish.yml` extended with `.NET` build/test/pack/NuGet-publish, and the yarn-migration
  regression in the existing npm-oriented steps fixed.

## What does not exist yet

In roughly the order the plan's Section 10 sequence suggests tackling it:

- **Codex** - the one vendor deliberately not given an `IAIProviderClient`: it is subscription-based
  rather than API-key and is an agent-harness provider only, so there is no chat-completion surface
  for it to implement. It needs the worker/harness scheduling layer (plan Section 5.6) instead.
- **`ProviderAwareLanguageModel`** (the actual resolution layer `ManagedLanguageModel` is meant to
  sit in front of) - blocked on pools, tiers, capabilities and the agent model below, all of which
  it resolves through. Read `AIProviders/ProviderAwareLanguageModel.cs` in Direct before starting
  this - it is ~215 lines with real production reasoning (issue #103) behind almost every branch.
- **Provider commands/projections** (`Adding/`, `Reconfiguring/`, `Removing/`, `Renaming/`,
  `SettingConcurrency/`, `SettingTierModels/`, `Listing/`, `Resolving/`).
- **Pools** (`PoolMemberSelector`, `ProviderBurn`, pool CRUD, `Listing`).
- **Tier/capability resolution** (`TierModelResolution`, `TierModelDefaults`, `RateLimiting/`,
  `HarnessSupport/`) - what `ProviderAwareLanguageModel` above resolves a tier through.
- **Available-model discovery**, reconciled from both donors.
- **Usage reporting** (vendor billing API readers - `ICanReportAIUsage`, OpenAI/Anthropic
  implementations).
- **Agents & AI configuration** - the full agent model (Direct's `Agents/` reconciled with Studio's
  `Settings/Agents/`), `AIConfiguration/`, and the explicit decision on Studio's legacy singleton AI
  settings (plan Section 5.5). `IAIAgents` exists as a lookup seam a consumer implements; the
  package does not yet own an agent model of its own.
- **Conversational API** (`Conversations/`) - the generic half of Studio's 8-partial `ChatClient`,
  `ConversationContext`/`Message`/`Request`/`Surroundings`, `Acting/`, `Mcp/` tool exposure. Not
  started. This is flagged in the plan itself as "the largest single judgement call in the whole
  plan" (Section 5.4) and should be budgeted accordingly.
- **Worker runtime implementations** (`DockerWorkerRuntime`, `KubernetesWorkerRuntime`), the
  callback contract (`WorkerCallbackTokens`, `WorkerResults`), and reconciling Direct's
  `Containers/` with Studio's `Infrastructure/Containers/` (plan risk #3).
- **Agent harness Docker images** (`Source/AgentHarnesses/` - `Dockerfile.base/claude/pi`,
  `entrypoint.sh`, `pi-extensions/`, `progress-mcp-server.mjs`, `skills/`) and their CI job.
- **`@cratis/ai` npm proxy workspace** (`Source/Cratis.AI.Proxies/`) - cannot exist meaningfully
  until there are commands/queries in the package for the ProxyGenerator to generate from. The
  drift-gate CI step and the route-shape decision (plan Section 6.4, `/api/a-i/...`) are recorded as
  TODOs in `publish.yml`'s comments but not yet exercised against real output.
- **Direct's migration PR** (delete the moved folders, thin adapters over the seams, swap generated
  `.ts` for `@cratis/ai`) - blocked on everything above existing first.
- **Studio's migration PR** (same, plus the new AI Usage page) - likewise blocked.
- **Production cutover** - the event-evolution scale-down/MongoDB-surgery procedure in decision 0002,
  and the nine end-to-end production checks in the plan's Section 12.1. Neither can happen before a
  product actually has new code to deploy. Also out of scope for an agent session to execute
  unattended regardless of readiness - both donor repos' own written policy
  (`project/deployment-is-ci-only.md`, `project/deploying-infrastructure-pulumi-ci-only-never-locally.md`)
  is explicit that production Pulumi/kubectl operations run through CI or a human operator with real
  credentials, never an agent session directly.

## Decisions on record

- [`decisions/0001-agent-identity-and-causation.md`](./decisions/0001-agent-identity-and-causation.md) -
  why identity and causation are first-class package concerns beyond the plan's original
  `IAIIdentityProvider` sketch, and why authorization stays out of the package's `IAgentExecution`.
- [`decisions/0002-event-evolution-no-migrations.md`](./decisions/0002-event-evolution-no-migrations.md) -
  no event-type migrations; evolve in place and repair production at rollout, per both donor repos'
  own standing policy. Supersedes an earlier draft of the same record that had proposed keeping old
  event types alive indefinitely.

Two decisions the plan itself flags as needing to be made without blocking (Section 12.0) remain
**not yet made** because nothing has reached the point of needing them: the Docker registry target
(plan risk #7 - Docker Hub vs. `ghcr.io`) and the route-shape prefix for package-owned
commands/queries (plan Section 6.4 - `/api/a-i/...`). Make these, and record them as decisions 0003
and 0004, before Step 6 (harness images) and Step 12 (the proxy workspace) respectively.
