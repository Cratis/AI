// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.RateLimiting;

/// <summary>
/// Event raised when a provider turned work away because its own usage limit was reached, rather
/// than because anything was wrong with the work.
/// </summary>
/// <remarks>
/// This matters most for a subscription. A metered API key answers "rate limited" and the next
/// attempt usually works; a ChatGPT plan has a usage allowance that, once spent, turns every attempt
/// away for hours. Without recording it, the scheduler would keep picking the same exhausted provider
/// and burning a whole worker session each time to rediscover the same answer - and on a pool, it
/// would do that instead of simply using the member that still has capacity.
/// </remarks>
/// <param name="Until">When the provider is worth trying again.</param>
[EventType]
public record AIProviderRateLimited(DateTimeOffset Until);

/// <summary>
/// Command for recording that a provider turned work away over its own usage limit - the one place
/// that appends <see cref="AIProviderRateLimited"/> for a caller that knows this directly, rather
/// than inferring it from a worker's own failure text the way <c>Work.Failing.FailWork</c> still
/// does. The completion path (<see cref="ProviderAwareLanguageModel"/>) is the first such caller
/// (issue #1060) - it sees the vendor's actual 429/quota response, not a report relayed through a
/// worker container.
/// </summary>
/// <param name="Provider">The provider that was rate-limited - its own identity resolves the event source.</param>
/// <param name="Until">When the provider is worth trying again.</param>
[Command]
public record RecordProviderRateLimited(AIProviderId Provider, DateTimeOffset Until)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderRateLimited"/> event to the provider's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public AIProviderRateLimited Handle() => new(Until);
}

/// <summary>
/// Recognizes a provider's own usage limit in what a worker reported back.
/// </summary>
/// <remarks>
/// This reads the failure text, which is not a contract - the harness passes through whatever the
/// vendor said. It is therefore deliberately narrow: matching too eagerly would park a healthy
/// provider for an hour over an unrelated failure, which is worse than not noticing. Anything not
/// recognized here simply fails the work the way it always did.
/// </remarks>
public static class ProviderRateLimit
{
    /// <summary>
    /// The phrases vendors use when the account, rather than the request, is the problem.
    /// </summary>
    static readonly string[] _markers =
    [
        "rate limit",
        "rate_limit",
        "429",
        "quota",
        "usage limit",
        "usage_limit",
        "too many requests",
        "insufficient_quota"
    ];

    /// <summary>
    /// Whether a failure says the provider turned the work away over its own limits.
    /// </summary>
    /// <param name="reason">What the worker reported.</param>
    /// <returns><see langword="true"/> when it reads as a usage limit.</returns>
    public static bool IsIndicatedBy(string reason) =>
        !string.IsNullOrWhiteSpace(reason) &&
        _markers.Any(marker => reason.Contains(marker, StringComparison.OrdinalIgnoreCase));
}
