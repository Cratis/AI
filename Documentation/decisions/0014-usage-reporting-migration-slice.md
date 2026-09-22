# 0014 - Vendor usage reporting as its own migration slice, decoupled from pool selection

Status: Accepted
Related: `Providers/UsageReporting/`, decision 0002, decision 0006, decision 0007, decision 0008.

## Context

Direct's Settings surface has no dedicated place to see how much of a configured AI provider's
vendor-reported usage or spend is left - the closest thing is a per-provider "tokens left of
ceiling" line buried in the provider-pools panel, computed from Direct's own recorded burn. Adding a
real usage page (a provider picker plus the vendor's own 30-day token/cost breakdown) needs the
vendor-usage-reporting engine `migration-status.md` already lists under "What does not exist yet":
`ICanReportAIUsage`, the Anthropic/OpenAI organization usage/cost readers, and the orchestrator that
resolves a provider's credential and asks the right one.

Direct's own `AIProviders.UsageReporting` namespace bundles three concerns that this record
deliberately splits apart:

1. **Reading a vendor's own 30-day usage/cost report** (`ICanReportAIUsage`,
   `AnthropicUsageReporting`, `OpenAIUsageReporting`, `AIUsageReporting`, `AIProviderUsageReport`) -
   vendor-specific HTTP logic, genuinely reusable, no event sourcing involved at all (the read model
   is `[Passive]` with no projection - it asks the vendor live, every query).
2. **The Admin API credential a usage report is read through** (`SetAIProviderUsageCredential`,
   `ClearAIProviderUsageCredential`, `AIProviderUsageCredentialSet/Cleared`) - ordinary provider
   configuration, the same shape as the credential CRUD decision 0006 already migrated.
3. **Refreshing a cached usage *level* ahead of a pool-selection ranking decision**
   (`ProviderUsageLevels`, `RecentUsageSnapshots`, `AIProviderUsageSnapshot`,
   `RecordAIProviderUsageSnapshot`, `ProviderBurn`) - tightly coupled to Direct's own pool dispatch
   (`ProviderAwareLanguageModel`, `ActingAgentResolver`, issue #1061's capacity-aware selection),
   none of which exists in this package yet (`ProviderAwareLanguageModel` is still listed as missing
   in `migration-status.md`).

## Decision

**Ported in this slice:** (1) and (2) only - `Providers/UsageReporting/` gains `ICanReportAIUsage`,
`AnthropicUsageReporting`, `OpenAIUsageReporting`, `IAIUsageReporting`/`AIUsageReporting`, the
`AIUsageReportAvailability` enum and `AIProviderUsageDay`/`AIProviderCostDay`/`AIProviderUsageReport`
DTOs and read model, and `Providers/UsageReporting/SettingCredential/` gains
`SetAIProviderUsageCredential`/`ClearAIProviderUsageCredential` and their two events. `Providers/
ConfiguredAIProvider` gains a `UsageApiKey` property, sourced from the two new events - additive only,
exactly as decision 0006's own remarks anticipated ("only its `[FromEvent]`/`[SetFrom]` wiring gains
more sources").

**`UsageApiKey` is a non-nullable sentinel-default property (`AIProviderApiKey.NotSet`), not a
nullable one** - deliberately matching Direct's own donor shape
(`AIProviders.Resolving.ConfiguredAIProvider.UsageApiKey`) rather than this record's existing
nullable optional parameters (`Endpoint`, `MaxConcurrentJobs`, `Model`). Direct's own doc comment on
that property is explicit about why: a nullable member on a `[Passive]` read model comes back
`null` from the running kernel no matter what the events say, while an in-process specification
populates it happily regardless - a real production gap stays invisible to every specification that
would otherwise catch it. This is not a stylistic inconsistency with the rest of the record; it is
the one property here where a documented production incident already settled the question.

**Both new event types are pinned to Direct's own implicit ids** - `"AIProviderUsageCredentialSet"`
and `"AIProviderUsageCredentialCleared"`, the bare type names Direct's own pre-migration same-named
types already resolve to (decision 0007's standing rule, decision 0008's reasoning for why the value
must match an existing donor rather than a fresh guid).

**Not ported in this slice, and why:** everything under (3) above. `ProviderUsageLevels` and its
supporting types read and write `RecordAIProviderUsageSnapshot`/`AIProviderUsageSnapshot` purely to
serve pool-selection ranking, which has no home in this package yet - porting the recording/snapshot
machinery without the pool dispatcher that actually consumes it would leave orphaned surface with no
real caller here. A usage *page* does not need it either: a provider's currently configured
`AIProviderUsageCapacity` ceiling (also not yet ported - `SettingUsageCapacity` stays with pool
selection) combined with this slice's own live `AIProviderUsageReport` is enough to show "how much is
left" without touching the cached-snapshot layer at all.

## Consequences

- Direct's cutover for this slice deletes `AIProviders.UsageReporting.ICanReportAIUsage`,
  `AnthropicUsageReporting`, `OpenAIUsageReporting`, `AIUsageReporting`/`IAIUsageReporting`, the
  `AIUsageReportAvailability` enum and `AIProviderUsageDay`/`AIProviderCostDay`/
  `AIProviderUsageReport`, and `UsageReporting.SettingCredential.SetAIProviderUsageCredential`/
  `ClearAIProviderUsageCredential`, repointing every consumer (`ProviderUsageLevels`,
  `Resolving.ConfiguredAIProvider`, `Listing.AIProvider`) at this package's types instead - the same
  treatment decision 0006 gave provider CRUD. `ProviderUsageLevels`, `RecentUsageSnapshots`,
  `RecordAIProviderUsageSnapshot`, and `Snapshots.AIProviderUsageSnapshot` stay in Direct unchanged,
  now consuming this package's `IAIUsageReporting` instead of their own local copy.
- The credential-setting commands use the package's `ISecretProtector`, exactly as every other
  provider-credential command already does (decision 0006) - no new secret-handling seam.
- A future pool-selection migration slice can still port (3) later; nothing here blocks it, and
  nothing here needs to be revisited when it happens - `ConfiguredAIProvider.UsageApiKey` is already
  the field that slice's own snapshot refresh would read.

## Alternatives rejected

- **Porting the whole `UsageReporting` namespace in one slice, snapshot machinery included.**
  Rejected - the snapshot/level-refresh layer exists only to serve a pool ranking decision that has
  no package-side consumer yet, so porting it now would add real surface with no real caller,
  the opposite of every prior slice's own "port what something here actually needs" discipline.
- **Giving `ICanReportAIUsage.ReportFor` a primitive `AIProviderApiKey` parameter instead of the
  package's `ConfiguredAIProvider`**, to avoid touching `ConfiguredAIProvider` at all. Rejected for
  consistency - `IAIProviderClient.Complete` already takes `ConfiguredAIProvider` directly, and a
  second vendor-client-shaped interface with a different calling convention in the same namespace
  would be a trap for the next person reading both side by side.
