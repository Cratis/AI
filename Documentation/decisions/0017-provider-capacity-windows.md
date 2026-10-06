# 0017 - Provider capacity windows, headroom, and parking a limit until it resets

## Status

Accepted

Related: `Providers/Capacity/`, `Providers/RateLimiting/`, `Providers/Pools/PoolMemberSelector.cs`,
`Providers/ProviderAwareLanguageModel.cs`, decision 0005 (pool failover and provider quota).

## Context

A Claude subscription provider in a consumer's pool hit its weekly limit. Worker failures arrived
as "You've hit your weekly limit · resets Oct 9, 2am (UTC)". Two things went wrong:

- `ProviderRateLimit.IsIndicatedBy` did not recognize the wording, so the work failed instead of
  failing over to another pool member.
- Had it been recognized, the provider would have been parked for the flat
  `AIProviderOptions.RateLimitCooldown` (one hour) although the limit reset days later. It would then
  have been retried every hour, wasting a worker session each time.

Pool ranking also had nothing to go on. It knew a hand-set token ceiling (`AIProviderUsageCapacity`)
minus consumed tokens, and local burn. The plans the pools actually run on are metered in windows:
Claude and Codex in five-hour and weekly windows, the Z.AI coding plan the same way, and Copilot in
monthly premium requests. All of them publish how much of each window is used.

## Decision

1. **Recognize subscription limits and read their stated reset.** `IsIndicatedBy` recognizes the
   Claude Code and harness wordings ("hit your limit", "hit your weekly limit", "5-hour limit
   reached", "usage limit reached", ...). Every new phrase names the account's own allowance, so
   ordinary failures that only mention a limit stay unrecognized. `ResetIndicatedBy(reason, now)`
   reads the reset when the text states one: a wall-clock time with an IANA zone, a date without a
   year, an ISO timestamp, or Claude Code's `|<epoch seconds>` suffix. An unknown zone yields `null`
   rather than a guess.
2. **Model capacity as usage windows.** `AIProviderCapacity` carries the provider's `UsageWindow`s,
   where they came from (`Subscription`, `ConfiguredCeiling`, `Unmetered`, `Unknown`), a single
   `Headroom` figure (the tightest window's remaining share), `CanStartWork`, and `AvailableAgainAt`.
   `AIProviderCapacityCalculator.Compute` is the one pure place these rules live.
3. **Read the windows from each vendor.** One `ICanReportAIProviderCapacity` per usage surface,
   discovered by convention: Claude's `api/oauth/usage` for a subscription OAuth token, ChatGPT's
   `backend-api/wham/usage` for a Codex subscription, GitHub's `copilot_internal/user`, and Z.AI's
   `api/monitor/usage/quota/limit`. Everything else is judged by its configured ceiling, or counted
   as unmetered. Each parser is a pure static `Parse` so it is specified from canned JSON.
4. **Cache, keep the last good figures, and back off.** `IAIProviderCapacityObservations` caches
   each provider's last read for `CapacityFreshness`. A failed read keeps serving the last good
   figures, which keep their original `ObservedAt` and carry the new problem. The next attempt waits
   for a back-off that starts at `CapacityFreshness` and doubles up to an hour. Concurrent reads of
   one provider share a single request. The Claude endpoint is undocumented and returns 429 readily,
   so this is what keeps it usable.
5. **Rank and admit pool members by capacity.** `PoolSelectionData.HeadroomByProvider` is ranked
   after recent failures and exhaustion, most headroom first, ahead of configured capacity and burn.
   `ProviderAwareLanguageModel` skips a member whose capacity says it cannot start work, as
   `PoolAttempt.Skipped`, without spending a call on it.
6. **Park a limit until it resets.** A recorded rate limit lasts until the reset the failure states.
   If the failure states none, it lasts until the capacity's `AvailableAgainAt`. It never lasts less
   than `RateLimitCooldown`, and a stated reset more than 31 days out is not trusted. The provider's
   cached capacity is then forgotten.

## Consequences

- **Unknown counts as full.** A provider whose capacity cannot be read has `Headroom` 1 and may
  start work, with `Source` saying it is unknown. Not knowing must never block work: an unreachable
  usage endpoint would otherwise take a healthy provider out of every pool.
- **`AvailableAgainAt` is the latest reset among the exhausted windows, not the earliest.** A
  five-hour window rolling over does not help while the weekly one is still spent.
- **`IAIProviderCapacities` is resolved per scope, not as a singleton.** It reads the provider
  through `IReadModels`, which belongs to the caller's tenant. The cache that outlives a scope,
  `IAIProviderCapacityObservations`, is the singleton. It holds only the vendors' figures, keyed by
  the globally unique provider id.
- **`AIProviderPoolDispatcher` skips only recorded rate limits.** It is registered as a singleton,
  so it cannot consult the tenant-bound capacities. Headroom-aware dispatch goes through
  `ProviderAwareLanguageModel`.
- **The subscription access token is used as stored and never refreshed for a capacity read.**
  OpenAI rotates the refresh token on every refresh, and a capacity read is not worth spending the
  subscription's one live lineage on. An expired token reads as an unknown capacity until dispatch
  refreshes it.
- **All four vendor surfaces are undocumented.** The parsers are tolerant: a missing field, a
  number sent as a string, or a null window reads as "not stated" rather than failing. The response
  shapes were taken from what the vendors' own clients read. They have not been verified against
  live endpoints from this repository.
- **Additive API.** `ProviderAwareLanguageModel` and `AIProviderPoolDispatcher` keep their previous
  constructors, which behave as before. Dependency injection picks the new, longer ones.

## Alternatives rejected

- **A longer flat cooldown.** A weekly limit can be days away or minutes away. Any single figure
  either wastes sessions or leaves recovered capacity idle. The vendor states the reset, so use it.
- **Treating an unknown capacity as exhausted.** This would be safer for a provider that really is
  spent, but one flaky usage endpoint would then sideline a working provider. The completion path
  still learns about a real limit from the vendor's own refusal, and records it.
- **Ranking by the configured ceiling only.** It describes a budget the operator chose, not the
  allowance the vendor enforces, and a subscription has no meaningful token ceiling to set.
