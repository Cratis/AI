// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Read model for how much of a configured provider's allowance is left right now, and whether it is
/// worth starting work on. Not event-projected: the answer belongs to the vendor, so it is asked live
/// (through a short-lived cache, see <see cref="IAIProviderCapacities"/>) per query, the same way
/// <see cref="UsageReporting.AIProviderUsageReport"/> is.
/// </summary>
/// <param name="Provider">The provider the capacity is for.</param>
/// <param name="Source">Where the figures came from.</param>
/// <param name="Windows">The usage windows the provider meters its allowance over - empty when nothing is metered or nothing is known.</param>
/// <param name="Headroom">
/// How much of the tightest window's allowance is left, from 0 to 1. A provider with no known
/// window - <see cref="AIProviderCapacitySource.Unmetered"/> or <see cref="AIProviderCapacitySource.Unknown"/> -
/// has a headroom of 1: not knowing must not block work, so an unknown provider ranks as if it were
/// fully available rather than as if it were spent, and <paramref name="Source"/> says it was unknown.
/// Zero while the provider is rate limited.
/// </param>
/// <param name="CanStartWork">Whether the provider has more than <see cref="AIProviderOptions.MinimumHeadroomToStartWork"/> left and is not rate limited.</param>
/// <param name="AvailableAgainAt">When a provider that cannot start work is expected to be able to again - the later of its rate-limit expiry and the resets of its exhausted windows - when known.</param>
/// <param name="RateLimitedUntil">When the rate limit recorded against the provider lifts, while one is in force.</param>
/// <param name="ObservedAt">When the figures were read from the vendor - earlier than now when a cached or last-good observation is served.</param>
/// <param name="Problem">Why the figures are stale or unknown, when they are.</param>
/// <remarks>
/// Computed by <see cref="AIProviderCapacityCalculator.Compute"/>. Marked <c>[Passive]</c> because
/// it has no projection, which stops it registering a dead observer and sink.
/// </remarks>
[ReadModel]
[Passive]
public record AIProviderCapacity(
    AIProviderId Provider,
    AIProviderCapacitySource Source,
    IReadOnlyList<UsageWindow> Windows,
    double Headroom,
    bool CanStartWork,
    DateTimeOffset? AvailableAgainAt,
    DateTimeOffset? RateLimitedUntil,
    DateTimeOffset ObservedAt,
    string? Problem)
{
    /// <summary>
    /// Says in plain words why this provider cannot start work, or that it can.
    /// </summary>
    /// <returns>The reason - never including a credential.</returns>
    public string Explain()
    {
        if (CanStartWork)
        {
            return "has capacity";
        }

        if (RateLimitedUntil is { } until)
        {
            return $"is paused until {until.UtcDateTime:yyyy-MM-dd HH:mm} UTC because its vendor turned work away over its usage limit " +
                "(it is tried again then; replacing its credential or clearing the pause in Settings > AI tries it at once)";
        }

        var spent = Windows.Where(window => window.Remaining <= 0.02d).ToList();
        if (spent.Count > 0)
        {
            var windows = string.Join(", ", spent.Select(window => $"{window.Name} window {Percent(window.UsedFraction)} used" + (window.ResetsAt is { } reset ? $" (resets {reset.UtcDateTime:yyyy-MM-dd HH:mm} UTC)" : string.Empty)));
            return $"has no usage left: {windows}";
        }

        return AvailableAgainAt is { } again
            ? $"is out of headroom ({Percent(Headroom)} left) until {again.UtcDateTime:yyyy-MM-dd HH:mm} UTC"
            : $"is out of headroom ({Percent(Headroom)} left)";
    }

    static string Percent(double fraction) => $"{Math.Round(fraction * 100).ToString(System.Globalization.CultureInfo.InvariantCulture)}%";

    /// <summary>
    /// Gets a configured provider's current capacity.
    /// </summary>
    /// <param name="providerId">The provider to ask about.</param>
    /// <param name="capacities">The <see cref="IAIProviderCapacities"/> that answers.</param>
    /// <returns>The capacity.</returns>
    public static Task<AIProviderCapacity> CapacityFor(AIProviderId providerId, IAIProviderCapacities capacities) =>
        capacities.For(providerId);
}
