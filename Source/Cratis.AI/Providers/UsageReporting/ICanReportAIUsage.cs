// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// Defines a system that reads one <see cref="AIProviderType"/>'s vendor-reported organization usage
/// and cost for the trailing 30 days - one implementation per vendor that publishes such a report,
/// discovered by convention. Ported from Direct's <c>AIProviders.UsageReporting.ICanReportAIUsage</c>
/// (migration-status.md, "Usage reporting"). Unlike a best-effort model catalog listing, a failure
/// here is expected to propagate: the orchestrator (<see cref="IAIUsageReporting"/>) is what turns it
/// into an <see cref="AIUsageReportAvailability.Unreachable"/> answer.
/// </summary>
public interface ICanReportAIUsage
{
    /// <summary>
    /// Gets the vendor this report serves.
    /// </summary>
    AIProviderType Type { get; }

    /// <summary>
    /// Reads the vendor's organization usage and cost report for the trailing 30 days.
    /// </summary>
    /// <param name="provider">The configured provider to ask - its usage credential already revealed.</param>
    /// <returns>The usage and cost data.</returns>
    /// <exception cref="HttpRequestException">Thrown when the vendor's API cannot be reached.</exception>
    Task<AIProviderUsageData> ReportFor(ConfiguredAIProvider provider);
}

/// <summary>
/// The token usage and cost data one vendor's <see cref="ICanReportAIUsage"/> reads for the trailing
/// 30 days - a plain internal DTO, not the <see cref="AIProviderUsageReport"/> read model itself, since
/// the orchestrator is what knows the provider id and availability.
/// </summary>
/// <param name="TokenUsage">Per-day, per-model token usage.</param>
/// <param name="Costs">Per-day total cost.</param>
public record AIProviderUsageData(IEnumerable<AIProviderUsageDay> TokenUsage, IEnumerable<AIProviderCostDay> Costs);
