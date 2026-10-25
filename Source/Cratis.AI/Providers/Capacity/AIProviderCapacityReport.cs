// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// What one vendor's <see cref="ICanReportAIProviderCapacity"/> read about a provider's allowance.
/// </summary>
/// <param name="Source">Where the windows came from - <see cref="AIProviderCapacitySource.Unknown"/> when the read failed.</param>
/// <param name="Windows">The usage windows the vendor reported.</param>
/// <param name="Problem">Why the read failed or does not apply, when it did.</param>
public record AIProviderCapacityReport(AIProviderCapacitySource Source, IReadOnlyList<UsageWindow> Windows, string? Problem)
{
    /// <summary>
    /// Gets a value indicating whether the vendor's usage surface does not apply to this provider -
    /// a Z.AI key that is not on a coding plan, for instance - so its capacity is better judged the
    /// way a plain API key's is, from its configured ceiling.
    /// </summary>
    public bool FallsBack { get; init; }

    /// <summary>
    /// Gets a value indicating whether the read failed, so the figures are unknown.
    /// </summary>
    public bool Failed => Source == AIProviderCapacitySource.Unknown && !FallsBack;

    /// <summary>
    /// Builds a report of a subscription's own usage windows.
    /// </summary>
    /// <param name="windows">The windows the vendor reported.</param>
    /// <returns>The <see cref="AIProviderCapacityReport"/>.</returns>
    public static AIProviderCapacityReport Subscription(IReadOnlyList<UsageWindow> windows) => new(AIProviderCapacitySource.Subscription, windows, null);

    /// <summary>
    /// Builds a report for a provider whose vendor says nothing limits it.
    /// </summary>
    /// <returns>The <see cref="AIProviderCapacityReport"/>.</returns>
    public static AIProviderCapacityReport Unmetered() => new(AIProviderCapacitySource.Unmetered, [], null);

    /// <summary>
    /// Builds a report for a read that failed.
    /// </summary>
    /// <param name="problem">Why it failed - never including a credential.</param>
    /// <returns>The <see cref="AIProviderCapacityReport"/>.</returns>
    public static AIProviderCapacityReport Unavailable(string problem) => new(AIProviderCapacitySource.Unknown, [], problem);

    /// <summary>
    /// Builds a report for a provider the vendor's usage surface does not apply to.
    /// </summary>
    /// <param name="reason">Why it does not apply.</param>
    /// <returns>The <see cref="AIProviderCapacityReport"/>.</returns>
    public static AIProviderCapacityReport NotApplicable(string reason) => new(AIProviderCapacitySource.Unknown, [], reason) { FallsBack = true };
}
