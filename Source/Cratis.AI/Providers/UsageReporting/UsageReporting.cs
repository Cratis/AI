// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// Why a provider's usage report is or is not available.
/// </summary>
public enum AIUsageReportAvailability
{
    /// <summary>
    /// The vendor has no organization usage/cost API this feature can call.
    /// </summary>
    NotSupportedForVendor,

    /// <summary>
    /// The vendor supports it, but no usage Admin API key has been set for the provider.
    /// </summary>
    NoCredentialConfigured,

    /// <summary>
    /// The vendor's usage report could not be reached or answered with an error.
    /// </summary>
    Unreachable,

    /// <summary>
    /// The usage report was read successfully.
    /// </summary>
    Available,
}

/// <summary>
/// One day's token usage for one model, as reported by the vendor's own organization usage API.
/// </summary>
/// <param name="Date">The day the usage occurred on.</param>
/// <param name="Model">The model the tokens were spent on.</param>
/// <param name="UncachedInputTokens">Input tokens that were not served from a prompt cache.</param>
/// <param name="CacheCreationTokens">Input tokens spent writing to a prompt cache.</param>
/// <param name="CacheReadTokens">Input tokens served from a prompt cache.</param>
/// <param name="OutputTokens">Output tokens generated.</param>
public record AIProviderUsageDay(
    DateOnly Date,
    ModelName Model,
    long UncachedInputTokens,
    long CacheCreationTokens,
    long CacheReadTokens,
    long OutputTokens);

/// <summary>
/// One day's total cost, as reported by the vendor's own organization cost API - not attributed to a
/// model, since neither Anthropic's nor OpenAI's cost report groups by model.
/// </summary>
/// <param name="Date">The day the cost was incurred on.</param>
/// <param name="CostInUsd">The total cost incurred that day, in US dollars.</param>
public record AIProviderCostDay(DateOnly Date, decimal CostInUsd);

/// <summary>
/// Read model for a configured AI provider's vendor-reported usage over the trailing 30 days. Not
/// event-projected: the answer belongs to the vendor, not to the consuming product, so it is asked
/// live per query. Ported from Direct's <c>AIProviders.UsageReporting.AIProviderUsageReport</c>
/// (migration-status.md, "Usage reporting").
/// </summary>
/// <param name="ProviderId">The provider the report is for.</param>
/// <param name="Availability">Why the report is or is not available.</param>
/// <param name="TokenUsage">Per-day, per-model token usage - empty unless <paramref name="Availability"/> is <see cref="AIUsageReportAvailability.Available"/>.</param>
/// <param name="Costs">Per-day total cost - empty unless <paramref name="Availability"/> is <see cref="AIUsageReportAvailability.Available"/>.</param>
/// <remarks>
/// Marked <c>[Passive]</c> because it has no projection, which stops it registering a dead observer
/// and sink.
/// </remarks>
[ReadModel]
[Passive]
public record AIProviderUsageReport(
    AIProviderId ProviderId,
    AIUsageReportAvailability Availability,
    IEnumerable<AIProviderUsageDay> TokenUsage,
    IEnumerable<AIProviderCostDay> Costs)
{
    /// <summary>
    /// Gets a configured provider's vendor-reported usage over the trailing 30 days.
    /// </summary>
    /// <param name="providerId">The provider to ask.</param>
    /// <param name="reporting">The <see cref="IAIUsageReporting"/> that asks the vendor.</param>
    /// <returns>The usage report.</returns>
    public static Task<AIProviderUsageReport> UsageReportFor(AIProviderId providerId, IAIUsageReporting reporting) =>
        reporting.For(providerId);
}
