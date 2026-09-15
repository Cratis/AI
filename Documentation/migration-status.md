# Migration status

A living record of where the consolidation actually is, against the plan's suggested PR sequence
(`ai-consolidation-plan.md` Section 10). Update this when a PR in the stack merges or a new one
opens - it is the fastest way for anyone (human or agent) picking this work up mid-stream to know
what exists, what is proven, and what is still assumption.

## Shipped

**`Cratis.AI` is a real, published NuGet package** (<https://www.nuget.org/packages/Cratis.AI>) and
`@cratis/pi` has released several times alongside it. All 17 PRs below are merged to `main`; each was
verified green (`dotnet build`, `dotnet test`, `yarn ci`, the corpus's own `yarn verify` self-check)
before merging, both locally and in the repository's real required CI checks (`verify`,
`dotnet verify`, `release-intent / verify`), and each merge triggered a real `publish.yml` run that
published a release - nothing was batched or held back to the end.

| PR | Branch | Contains |
|---|---|---|
| #315 | `feat/dotnet-scaffolding` | Phase 1: .NET + yarn workspace scaffolding (plus the npm->yarn CI fix, pulled forward into this PR once caught) |
| #316 | `feat/cratis-ai-abstractions` | `Cratis.AI` project + `Abstractions/` seams, agent identity/causation (`IAgentExecution`) |
| #317 | `feat/usage-subsystem` | Usage subsystem: concepts, `AgentSessionUsageRecorded`, `RecordAgentSessionUsage`, read models, decision 0002 |
| #318 | `feat/providers-core` | `ILanguageModel`, `LanguageModelResult`, `ManagedLanguageModel` |
| #319 | `feat/workers-core` | `IWorkerRuntime`, `WorkerJob`, `WorkerRuntimeOptions`, `IKubernetesClientFactory` (interface layer only) |
| #320 | `feat/ci-workflows` | Added `.NET` build/pack/NuGet-publish jobs to `publish.yml` (this is what made the NuGet publish above possible); pinned two unpinned action references the real CI run caught |
| #321 | `feat/providers-concepts` | Provider vocabulary: `AIProviderName/Type/ApiKey/Endpoint`, `ModelTier`, `MaxConcurrentJobs`, `Effort` |
| #322 | `feat/root-documentation` | This `Documentation/` folder |
| #323 | `feat/provider-client-seam` | `IAIProviderClient` + the first concrete vendor client (`OpenAICompatible`) |
| #324 | `feat/anthropic-client` | Anthropic vendor client + credential classification |
| #325 | `feat/openai-client` | OpenAI + Azure OpenAI vendor clients + credential classification |
| #326 | `feat/zai-client` | ZAI vendor client (Anthropic-compatible protocol) |
| #327 | `feat/provider-concurrency-gate` | `ProviderConcurrencyGate` + `AIProviderOptions` |
| #329 | `feat/tier-models` | `TierModels`, `TierModelDefaults`, `TierModelResolution` |
| #330 | `feat/pools` | Pool concepts, `PoolMemberSelector`, `ProviderBurn` (rewired onto `IRecordedAgentSessions`) |
| #331 | `feat/capabilities` | `AgentInvocationMode`, `AIModelCapability`/`AIProviderCapability`, `AIModelCapabilities` |
| #333 | `feat/ai-proxies` | `@cratis/ai` (Phase 3b) - `Cratis.Arc.ProxyGenerator.Build` wired into `Cratis.AI.csproj`, `Source/Cratis.AI.Proxies`, decision 0004 |
| #338 | `feat/pool-failover-and-quota` | [Cratis/AI#337](https://github.com/Cratis/AI/issues/337): `AIProviderPoolDispatcher` fails over to the next pool member on a transient failure; `IAIProviderQuotaTracker`/`AIProviderQuotaHeaders` read each vendor's own rate-limit headers so a known-exhausted member is skipped before it is ever called; `AgentUsageByDay` now carries CPU/memory alongside tokens, so resource usage is visible per agent/purpose, not only as an undifferentiated weekly total; decision 0005 |
| #339, #340 | `feat/provider-crud`, `feat/provider-reconfigure` | First real migration slice: `Providers/Adding/` and `Reconfiguring/` (all 5 vendors, including "blank keeps existing" semantics), `Renaming/`, `Removing/`, `ConfiguredAIProvider` upgraded from placeholder record to a real `[ReadModel][Passive]` projection - a complete provider CRUD surface; decision 0006 |
| #342 | `fix/pin-provider-crud-event-ids` | [Cratis/AI#341](https://github.com/Cratis/AI/issues/341): pinned explicit `EventTypeId` on all 12 provider CRUD events - Chronicle's type-name-based default id collided with Direct's own pre-migration same-named types the moment both loaded in one process; decision 0007 |
| #343 | `fix/match-donor-event-type-ids` | Corrected #342's chosen id *values* - matched to Direct's own pre-existing implicit type-name ids instead of fresh guids, so Direct's real, already-stored provider events stay readable once Direct's own duplicate types are deleted; decision 0008 |
| #344 | `fix/openai-event-ids-stay-distinct` | Kept `OpenAIProviderAdded`/`OpenAIProviderReconfigured`'s ids distinct from Direct's, since Direct deliberately keeps its own OpenAI commands (credential-kind classification, not yet ported) - matching them would have recreated the exact collision decisions 0007/0008 exist to prevent |
| #345 | `feat/studio-provider-shape` | `Providers/Configuring/` - Studio's own provider shape (one `XModelConfigured` event covers add+reconfigure, a `Model` field, `AIModelRenamed`/`AIModelRemoved`), carried alongside Direct's rather than forced into it; `ConfiguredAIProvider` gained a `Model` field; decision 0009 |

### Dependency alignment (plan Section 2.5 / risk #6)

Studio was already on `Cratis`/`Cratis.Arc` 22.14.0 and `Cratis.Chronicle` 18.1.6 - the set `Cratis.AI`
is pinned to. Direct was behind (22.13.1 / 18.1.4); a version-alignment PR
(`Cratis/Direct#993`, `chore/align-cratis-arc-chronicle-versions`) bumps it to match, verified with a
full `dotnet build` (clean proxy regeneration, zero output drift) and all 4,498 of Direct's own specs
passing. **Opened for review, not merged** - Direct's own `project/deployment-is-ci-only.md` states a
merge with a release label is the production deploy decision with no separate approval gate, which is
a call for whoever owns that deployment, not something to do unattended.

### `@cratis/ai` (Phase 3b, plan Section 6)

**Real, generated, published** - `Cratis.Arc.ProxyGenerator.Build` reflects over the compiled
`Cratis.AI.dll` with no ASP.NET Core hosting involved (it works off any compiled assembly - Studio's
Core.csproj already proves this by referencing `Cratis.Arc.Core` + `Cratis.Arc.ProxyGenerator.Build`
directly rather than the ASP.NET-oriented `Cratis` metapackage, which is what `Cratis.AI.csproj` now
does too). Generates today: `RecordAgentSessionUsage` (1 command) and `AgentUsageByWeek.RecentWeeks`/
`AgentUsageByMonth.RecentMonths`/`AgentUsageByDay.LastYear` (3 queries), routed under `/api/a-i/...`
per decision 0004. `yarn workspace @cratis/ai run ci` (clean, lint, build) passes; the CI drift gate
rebuilds `Cratis.AI` and diffs `Source/Cratis.AI.Proxies/generated` against what is committed.

Two real bugs surfaced and fixed getting this far, both documented in decision 0004 - worth knowing
about before anyone else hits them:
- A plain class library does not copy its NuGet dependencies to its own output directory by default,
  which crashes the generator's reflection-only assembly resolution. Fixed with
  `CopyLocalLockFileAssemblies=true` on `Cratis.AI.csproj`.
- `SkipOutputDeletion=false` wipes its entire output directory on every build, which cannot be the
  package root without taking `package.json`/`tsconfig.json`/`rollup.config.mjs`/`index.ts` with it.
  Fixed by pointing `CratisProxiesOutputPath` at a `generated/` subfolder instead.

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
- `TierModels`/`TierModelDefaults`/`TierModelResolution` - the vendor-neutral capability-tier
  ladder (`Fast`/`Balanced`/`Powerful`/`Premier`) and its resolution to a concrete per-vendor model.
- `Providers/Pools/`: `AIProviderPoolId`/`AIProviderPoolName`/`AIProviderPoolMember` (the last one
  intentionally minimal, like `ConfiguredAIProvider`), `PoolMemberSelector` (least-burnt pick, pure
  function), and `ProviderBurn` - rewired onto the package's own `Usage.Daily.IRecordedAgentSessions`
  in place of Direct's `ILanguageModelJobs`, so pool selection already reads the package's own usage
  facts rather than a donor-specific source that does not exist here.
- `Agents/AgentInvocationMode` (Chat vs Job) and `Providers/AIModelCapability`/`AIProviderCapability`/
  `AIModelCapabilities` - capability inference from a model identifier, and whether a model/mode
  pairing is satisfiable. The last piece `ProviderAwareLanguageModel` needs before only the agent
  model itself is missing.
- `AddCratisAI()` registration with the type-discovery ordering self-check.
- `publish.yml` extended with `.NET` build/test/pack/NuGet-publish, and the yarn-migration
  regression in the existing npm-oriented steps fixed.

## What does not exist yet

In roughly the order the plan's Section 10 sequence suggests tackling it:

- **Codex** - the one vendor deliberately not given an `IAIProviderClient`: it is subscription-based
  rather than API-key and is an agent-harness provider only, so there is no chat-completion surface
  for it to implement. It needs the worker/harness scheduling layer (plan Section 5.6) instead.
- **`ProviderAwareLanguageModel`** (the actual resolution layer `ManagedLanguageModel` is meant to
  sit in front of) - the selection/burn/tier machinery it needs now all exists; what is missing is
  the agent model it resolves a purpose's provider/pool/tier/effort from (plan Section 5.5) and the
  real `ConfiguredAIProvider`/`AIProviderPool` projections below. Read
  `AIProviders/ProviderAwareLanguageModel.cs` in Direct before starting this - it is ~215 lines with
  real production reasoning (issue #103) behind almost every branch.
- **Provider commands/projections** - complete for both real donor shapes now. Direct's:
  `Adding/`/`Reconfiguring/` (all 5 vendors, "blank keeps the existing value" semantics included),
  `Renaming/`, `Removing/` (decision 0006). Studio's, differently shaped (one event covers
  add+reconfigure, a `Model` field, no concurrency bound): `Configuring/` (4 vendors - Studio has no
  ZAI) plus its own `RenameAIProvider`/`RemoveAIProvider` (decision 0009). `ConfiguredAIProvider` is
  a real `[ReadModel][Passive]` projection accumulating from both. Still missing for both:
  `SettingConcurrency/`, `SettingTierModels/`, `Listing/` (the display-name-bearing model a UI lists
  providers from - `ConfiguredAIProvider` deliberately has no name, matching both donors). OpenAI's
  subscription-credential-kind classification event (Direct-only) is also not yet ported (belongs
  with Codex, below).
- **Pool CRUD/projections** (create/rename/remove pool, add/remove provider, `Listing/`) - needed
  before `AIProviderPoolMember` (#330) is populated by anything other than a consumer constructing
  it directly.
- **Rate limiting & harness support** (`RateLimiting/`, `HarnessSupport/`) - the last provider-layer
  pieces before `ProviderAwareLanguageModel` itself. Everything else it resolves through
  (concurrency gate, tier resolution, pool selection, capability checks) now exists.
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
- **More of `@cratis/ai`** - the package exists and publishes for real (see above), but it only has
  what the package itself has: one command, three queries. It grows automatically as the provider/
  agent/conversational work above lands - no more proxy-workspace scaffolding needed, just more
  commands and read models in `Cratis.AI` itself, plus one `index.ts` export line per new top-level
  namespace folder (decision 0004).
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
- [`decisions/0004-proxy-route-shape-and-package-layout.md`](./decisions/0004-proxy-route-shape-and-package-layout.md) -
  the `/api/a-i/...` route prefix, the `generated/` subfolder layout `@cratis/ai` needs to survive
  `SkipOutputDeletion=false`, and the `CopyLocalLockFileAssemblies` fix proxy generation needed on a
  plain class library.

- [`decisions/0009-studio-provider-shape-lives-alongside-directs.md`](./decisions/0009-studio-provider-shape-lives-alongside-directs.md) -
  Studio's real provider events are differently *shaped* from Direct's, not just differently named -
  one event covers add+reconfigure, carries a `Model` field Direct's has no equivalent for. Carried
  as its own `Providers/Configuring/` namespace rather than forced into Direct's shape.
- [`decisions/0008-provider-crud-event-ids-match-directs-implicit-ones.md`](./decisions/0008-provider-crud-event-ids-match-directs-implicit-ones.md) -
  corrects decision 0007's choice of id *value* (fresh guids) to match what Direct's own
  pre-migration same-named types already implicitly resolve to, so cutting Direct over does not
  orphan its real, already-stored provider events.
- [`decisions/0007-pin-explicit-event-type-ids-for-provider-crud.md`](./decisions/0007-pin-explicit-event-type-ids-for-provider-crud.md) -
  Chronicle resolves an unpinned event type's id from its bare CLR type name with no namespace
  qualification - a real collision with Direct's own pre-migration same-named types, found the first
  time a consumer actually tried to load both. Now the standing rule for every future event type.
- [`decisions/0006-provider-crud-first-migration-slice.md`](./decisions/0006-provider-crud-first-migration-slice.md) -
  why provider CRUD is the first real migration slice, what it ported (Add/Reconfigure/Rename/Remove
  - a complete CRUD surface - and the real `ConfiguredAIProvider` projection, including how
  Reconfigure's "blank keeps existing" semantics resolve current state inside a command handler) and
  what it deliberately still does not (pool CRUD and everything else listed under "what does not
  exist yet").
- [`decisions/0005-pool-failover-and-provider-quota.md`](./decisions/0005-pool-failover-and-provider-quota.md) -
  pool-level failover on a transient failure, provider-reported quota read ahead of a call, and why
  a known-exhausted reading is trusted only when it still leaves the pool a candidate to try.

One decision the plan itself flags as needing to be made without blocking (Section 12.0) remains
**not yet made**, because nothing has reached the point of needing it: the Docker registry target
(plan risk #7 - Docker Hub vs. `ghcr.io`). Make it, and record it as decision 0003, before Step 6
(harness images).
