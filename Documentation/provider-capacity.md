# Provider capacity

A pool is only as good as its idea of which member can actually take work. Subscription plans
meter their allowance in windows:

| Vendor | Windows |
|---|---|
| Claude subscription | 5-hour, weekly, and weekly per model (Opus, Sonnet) |
| ChatGPT / Codex subscription | 5-hour and weekly |
| Z.AI coding plan | 5-hour and weekly |
| GitHub Copilot | Monthly premium requests |

`Source/Cratis.AI/Providers/Capacity/` reads those windows from each vendor and turns them into one
figure pool selection can rank by. The reasoning behind the design is in
[decision 0017](./decisions/0017-provider-capacity-windows.md).

## Ask for a provider's capacity

Inject `IAIProviderCapacities`:

```csharp
public interface IAIProviderCapacities
{
    Task<AIProviderCapacity> For(AIProviderId provider, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<AIProviderId, AIProviderCapacity>> ForMany(IReadOnlyCollection<AIProviderId> providers, CancellationToken cancellationToken = default);
    void Forget(AIProviderId provider);
}
```

A frontend asks through the generated `CapacityFor` query in `@cratis/ai`, which calls
`AIProviderCapacity.CapacityFor(providerId)`. Like `UsageReportFor`, it is a live call, not a
projected read model.

## What a capacity says

| Property | Meaning |
|---|---|
| `Source` | `Subscription` (the vendor reported its windows), `ConfiguredCeiling` (the hand-set `AIProviderUsageCapacity` measured against consumed tokens), `Unmetered`, or `Unknown` (the read failed). |
| `Windows` | Each `UsageWindow`: its `Kind` (`FiveHour`, `Daily`, `Weekly`, `Monthly`, `Other`), a human `Name`, `UsedFraction` from 0 to 1, and `ResetsAt` when the vendor says. |
| `Headroom` | The tightest window's remaining share, from 0 to 1. A provider with no windows, unmetered or unknown, has a headroom of 1. Zero while a rate limit is in force. |
| `CanStartWork` | `Headroom` is above `MinimumHeadroomToStartWork` and no rate limit is in force. |
| `AvailableAgainAt` | When a provider that cannot start work is expected back: the later of its rate-limit expiry and the resets of its exhausted windows. |
| `RateLimitedUntil` | The recorded rate limit, while one is in force. |
| `ObservedAt` | When the vendor's figures were read. It is earlier than now when a cached or last-good read is served. |
| `Problem` | Why the figures are stale or unknown, when they are. |

An unknown capacity counts as fully available on purpose. Not being able to read a usage endpoint
must not take a working provider out of a pool. The completion path still learns about a real limit
from the vendor's own refusal.

## How pools use it

`ProviderAwareLanguageModel` reads every pool member's capacity before ranking. It fills
`PoolSelectionData.HeadroomByProvider` from it, and `PoolMemberSelector` orders members like this:

1. A member that failed a real call recently goes last.
2. A member with no headroom, or an exhausted configured ceiling, goes after every member that has
   some.
3. The most headroom goes first. An unknown headroom counts as 1.
4. Then known remaining configured capacity, the least burnt over the trailing week, the fewest
   recent jobs, and declaration order.

A member whose capacity says it cannot start work is skipped without being called.

When a provider turns work away over its own limit, the rate limit is recorded until:

- the reset stated in the failure, such as "resets Oct 9, 2am (UTC)", or
- failing that, the capacity's `AvailableAgainAt`,
- and never less than `RateLimitCooldown`.

Its cached capacity is then forgotten, so the next read is fresh.

## When a provider's quota is spent

Throttling and a spent quota both tend to arrive as a 429, but they need different answers.
Throttling clears in seconds, so the call keeps its retry after `Retry-After`. A spent quota, spend
limit or credit balance does not come back until the vendor's period resets or someone tops it up,
so retrying the same provider only wastes the wait.

`QuotaExhaustion` tells them apart from the vendor's own error code or message:

| Vendor | Signal |
|---|---|
| Anthropic | `enforced_spend_limit_reached`, or "Your credit balance is too low" |
| OpenAI, Azure OpenAI | `insufficient_quota`, `billing_hard_limit_reached`, or "You exceeded your current quota" |
| OpenAI-compatible gateways | HTTP 402 Payment Required |

An ordinary `rate_limit_error` without one of these stays throttling. A spent quota comes back as a
`LanguageModelResult` with `IsQuotaExhausted` set. It is not transient, so `ManagedLanguageModel`
does not retry it. Instead:

- The provider is parked exactly like a rate limit, until the stated reset, the capacity's
  `AvailableAgainAt`, or `RateLimitCooldown`, so later calls skip it without spending a request.
- A pool sends the same request on to the next member. For a completion that is the same prompt; for
  a conversation it is the same messages and chat options.
- When every member is out of quota, the call fails with a reason that says the pool is exhausted
  and names each provider tried. `PoolDispatchResult` also exposes them as `TriedProviders` and
  `QuotaExhaustedProviders`.

A Claude Code conversation that has already attempted a tool call still does not fail over, quota or
not, because replaying the turn elsewhere could repeat the tool's effects.

## Options

Bound from `Cratis:AI:Providers` (`AIProviderOptions`):

| Option | Default | Meaning |
|---|---|---|
| `MinimumHeadroomToStartWork` | `0.02` | How much of the tightest window must be left for work to start. Slightly above zero, because a worker session started on a nearly spent window is likely to be turned away part-way through. |
| `CapacityFreshness` | 5 minutes | How long a vendor's figures are served from the cache. It is also the first back-off after a failed read, which doubles up to an hour. |
| `CapacityReportTimeout` | 10 seconds | How long a vendor's usage surface may take. |
| `RateLimitCooldown` | 1 hour | The shortest a recorded rate limit lasts, and the whole of it when nothing states a reset. |

## Add a vendor

Implement `ICanReportAIProviderCapacity`. Convention discovers it, so it needs no registration.
Return `AIProviderCapacityReport.Subscription(windows)`, `Unmetered()`, `Unavailable(problem)` for a
failed read, or `NotApplicable(reason)` for a credential the surface does not apply to. A
`NotApplicable` provider falls back to its configured ceiling. Keep the response parsing in a pure
static `Parse` method so it can be specified from canned JSON, and never put a credential in a
problem text.
