// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;
using Cratis.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Represents an implementation of <see cref="IAIProviderCapacities"/> - asks the vendor's own
/// <see cref="ICanReportAIProviderCapacity"/> through the shared
/// <see cref="IAIProviderCapacityObservations"/> cache, and judges a provider no vendor surface
/// reports on by its configured <see cref="AIProviderUsageCapacity"/> ceiling, or as unmetered.
/// </summary>
/// <remarks>
/// Resolved per scope rather than as a singleton: it reads the provider through
/// <see cref="IReadModels"/>, which belongs to the caller's tenant. The cache that outlives a scope
/// is <see cref="IAIProviderCapacityObservations"/>, which holds nothing tenant-bound but the
/// vendor's own figures, keyed by the globally unique provider id.
/// </remarks>
/// <param name="readModels">The <see cref="IReadModels"/> the provider - and its credential, decrypted by Chronicle on read - is resolved from.</param>
/// <param name="reporters">Every discovered <see cref="ICanReportAIProviderCapacity"/>.</param>
/// <param name="observations">The cache of what each vendor last reported.</param>
/// <param name="usageLevels">The usage level a configured ceiling is measured against.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> a rate limit is checked against.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> the minimum headroom comes from.</param>
/// <param name="logger">The logger.</param>
public class AIProviderCapacities(
    IReadModels readModels,
    IInstancesOf<ICanReportAIProviderCapacity> reporters,
    IAIProviderCapacityObservations observations,
    IProviderUsageLevels usageLevels,
    TimeProvider timeProvider,
    IOptions<AIProviderOptions> options,
    ILogger<AIProviderCapacities> logger) : IAIProviderCapacities
{
    /// <summary>
    /// The label of the window a configured ceiling is reported as.
    /// </summary>
    public const string ConfiguredCapacity = "Configured capacity";

    /// <inheritdoc/>
    public async Task<AIProviderCapacity> For(AIProviderId provider, CancellationToken cancellationToken = default)
    {
        var configured = await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider);
        if (configured is null)
        {
            logger.CapacityOfUnknownProvider(provider);
            return Capacity(provider, AIProviderCapacityReport.Unavailable("The provider is not configured"), timeProvider.GetUtcNow(), null);
        }

        var reporter = reporters.FirstOrDefault(candidate => candidate.CanReport(configured));
        if (reporter is not null)
        {
            var observation = await observations.Observe(provider, ct => reporter.Report(configured, ct), cancellationToken);
            if (!observation.Report.FallsBack)
            {
                if (observation.Report.Problem is { } problem)
                {
                    logger.CapacityNotRead(provider, configured.Type, problem);
                }

                return Capacity(provider, observation.Report, observation.ObservedAt, configured.RateLimitedUntil);
            }
        }

        return Capacity(provider, await FromCeiling(configured, cancellationToken), timeProvider.GetUtcNow(), configured.RateLimitedUntil);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyDictionary<AIProviderId, AIProviderCapacity>> ForMany(IReadOnlyCollection<AIProviderId> providers, CancellationToken cancellationToken = default)
    {
        var ids = providers.Distinct().ToList();
        var capacities = await Task.WhenAll(ids.Select(id => For(id, cancellationToken)));
        return ids.Zip(capacities).ToDictionary(pair => pair.First, pair => pair.Second);
    }

    /// <inheritdoc/>
    public void Forget(AIProviderId provider) => observations.Forget(provider);

    AIProviderCapacity Capacity(AIProviderId provider, AIProviderCapacityReport report, DateTimeOffset observedAt, DateTimeOffset? rateLimitedUntil) =>
        AIProviderCapacityCalculator.Compute(provider, report.Source, report.Windows, report.Problem, observedAt, rateLimitedUntil, timeProvider.GetUtcNow(), options.Value.MinimumHeadroomToStartWork);

    async Task<AIProviderCapacityReport> FromCeiling(ConfiguredAIProvider configured, CancellationToken cancellationToken)
    {
        if (!configured.UsageCapacity.IsLimited)
        {
            return AIProviderCapacityReport.Unmetered();
        }

        var levels = await usageLevels.RefreshMany([configured.Id], cancellationToken);
        var consumed = levels.TryGetValue(configured.Id, out var level) ? level.ConsumedTokens : 0L;
        var window = new UsageWindow(UsageWindowKind.Other, ConfiguredCapacity, (double)consumed / configured.UsageCapacity.Value, null);
        return new(AIProviderCapacitySource.ConfiguredCeiling, [window], null);
    }
}
