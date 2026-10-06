// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Computes a provider's <see cref="AIProviderCapacity"/> - headroom, whether work may start, and
/// when it may again - from its usage windows and any rate limit in force. Pure, so the rules are
/// directly specifiable; kept off the read model itself so it is not exposed as a query.
/// </summary>
public static class AIProviderCapacityCalculator
{
    /// <summary>
    /// Computes a provider's capacity from what is known about it.
    /// </summary>
    /// <param name="provider">The provider.</param>
    /// <param name="source">Where <paramref name="windows"/> came from.</param>
    /// <param name="windows">The provider's usage windows.</param>
    /// <param name="problem">Why the figures are stale or unknown, when they are.</param>
    /// <param name="observedAt">When the figures were read.</param>
    /// <param name="rateLimitedUntil">When a rate limit recorded against the provider lifts - in the past, or <see langword="null"/>, when none is in force.</param>
    /// <param name="now">The current time.</param>
    /// <param name="minimumHeadroom">How much headroom a provider must have left to be worth starting work on - see <see cref="AIProviderOptions.MinimumHeadroomToStartWork"/>.</param>
    /// <returns>The <see cref="AIProviderCapacity"/>.</returns>
    /// <remarks>
    /// When a provider cannot start work because windows are exhausted, it is available again only
    /// once <i>every</i> exhausted window has reset - a five-hour window rolling over does not help
    /// while the weekly one is still spent - so <see cref="AIProviderCapacity.AvailableAgainAt"/> is the latest of their
    /// resets, not the earliest.
    /// </remarks>
    public static AIProviderCapacity Compute(
        AIProviderId provider,
        AIProviderCapacitySource source,
        IReadOnlyList<UsageWindow> windows,
        string? problem,
        DateTimeOffset observedAt,
        DateTimeOffset? rateLimitedUntil,
        DateTimeOffset now,
        double minimumHeadroom)
    {
        var headroom = windows.Count == 0 ? 1d : windows.Min(window => window.Remaining);
        var exhaustedReset = windows
            .Where(window => window.UsedFraction >= 1 - minimumHeadroom && window.ResetsAt is not null)
            .Max(window => window.ResetsAt);

        if (rateLimitedUntil is { } until && until > now)
        {
            var availableAgain = exhaustedReset is { } reset && reset > until ? reset : until;
            return new AIProviderCapacity(provider, source, windows, 0d, false, availableAgain, until, observedAt, problem);
        }

        var canStartWork = headroom > minimumHeadroom;
        return new AIProviderCapacity(provider, source, windows, headroom, canStartWork, canStartWork ? null : exhaustedReset, null, observedAt, problem);
    }
}
