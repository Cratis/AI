// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Defines a system that reads a provider's allowance from its vendor - one implementation per
/// vendor usage surface, discovered by convention. A provider no implementation can report on is
/// judged by its configured <see cref="AIProviderUsageCapacity"/> ceiling, or as unmetered.
/// </summary>
/// <remarks>
/// An implementation may throw <see cref="HttpRequestException"/> or
/// <see cref="System.Text.Json.JsonException"/> - <see cref="IAIProviderCapacities"/> is the single
/// place that turns either into an unknown capacity, so implementations stay simple.
/// </remarks>
public interface ICanReportAIProviderCapacity
{
    /// <summary>
    /// Whether this implementation can report on the provider - its vendor and the kind of credential it holds.
    /// </summary>
    /// <param name="provider">The provider, its credential already revealed.</param>
    /// <returns><see langword="true"/> when it can.</returns>
    bool CanReport(ConfiguredAIProvider provider);

    /// <summary>
    /// Reads the provider's allowance from its vendor.
    /// </summary>
    /// <param name="provider">The provider, its credential already revealed.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="AIProviderCapacityReport"/>.</returns>
    Task<AIProviderCapacityReport> Report(ConfiguredAIProvider provider, CancellationToken cancellationToken);
}
