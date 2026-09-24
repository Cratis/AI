// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Providers.UsageReporting.RecordingSnapshot;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PackageAIProviderId = Cratis.AI.Providers.AIProviderId;

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// Defines the system that refreshes providers' usage levels ahead of a pool selection decision -
/// the shared step both chat completions (<see cref="ProviderAwareLanguageModel"/>) and work
/// dispatch (<c>Work.Scheduling.ActingAgentResolver</c>) run before ranking a pool's members,
/// so the decision uses current numbers rather than Direct's own recorded burn alone (issue #1061).
/// </summary>
public interface IProviderUsageLevels
{
    /// <summary>
    /// Refreshes the usage level for every given provider - vendor-reported where a usage credential
    /// is configured and the report answers within its timeout, Direct's own trailing-week burn
    /// otherwise. A provider refreshed within <see cref="AIProviderOptions.UsageSnapshotFreshness"/>
    /// answers from its cached level instead of asking the vendor again.
    /// </summary>
    /// <param name="providerIds">The providers to refresh.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The usage level per provider.</returns>
    Task<IReadOnlyDictionary<AIProviderId, ProviderUsageLevel>> RefreshMany(IReadOnlyCollection<AIProviderId> providerIds, CancellationToken cancellationToken = default);
}

/// <summary>
/// One provider's usage level at the moment it was last refreshed - what <see cref="IProviderUsageLevels"/>
/// answers with, and what <see cref="Pools.PoolMemberSelector"/> ranks capacity-aware selection off
/// (issue #1061).
/// </summary>
/// <param name="Availability">Why the vendor-reported usage was or was not available for this level.</param>
/// <param name="ConsumedTokens">The tokens counted as consumed - vendor-reported where <paramref name="Availability"/> is <see cref="AIUsageReportAvailability.Available"/>, Direct's own trailing-week burn otherwise.</param>
/// <param name="UsedLocalBurnFallback">Whether <paramref name="ConsumedTokens"/> came from Direct's own trailing-week burn rather than the vendor's usage report.</param>
/// <param name="Ceiling">The provider's configured <see cref="AIProviderUsageCapacity"/> - <see langword="null"/> until one is set.</param>
public record ProviderUsageLevel(AIUsageReportAvailability Availability, long ConsumedTokens, bool UsedLocalBurnFallback, AIProviderUsageCapacity? Ceiling)
{
    /// <summary>
    /// Gets how many tokens are left within the provider's configured ceiling - <see langword="null"/>
    /// when no ceiling is configured, in which case selection falls back to the existing least-burnt
    /// ranking. Never negative: a provider that has gone over its ceiling has zero left, not a debt.
    /// </summary>
    public long? RemainingCapacity => Ceiling is { IsLimited: true } ceiling ? Math.Max(0, ceiling.Value - ConsumedTokens) : null;
}

/// <summary>
/// Represents an implementation of <see cref="IProviderUsageLevels"/>.
/// </summary>
/// <param name="usageReporting">The vendor-reported usage the refresh prefers when a provider has a usage credential configured.</param>
/// <param name="readModels">The <see cref="IReadModels"/> a provider's configured <see cref="AIProviderUsageCapacity"/> ceiling is read from.</param>
/// <param name="providerBurn">The recorded-burn fallback for a provider with no vendor usage report available.</param>
/// <param name="recentSnapshots">The freshness cache a refresh reuses from, and records into.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> a refreshed level is recorded through, so the decision is auditable.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> the freshness window and per-provider report timeout are read from.</param>
/// <param name="logger">The logger.</param>
public class ProviderUsageLevels(
    IAIUsageReporting usageReporting,
    IReadModels readModels,
    IProviderBurn providerBurn,
    IRecentUsageSnapshots recentSnapshots,
    ICommandPipeline commandPipeline,
    IOptions<AIProviderOptions> options,
    ILogger<ProviderUsageLevels> logger) : IProviderUsageLevels
{
    /// <inheritdoc/>
    public async Task<IReadOnlyDictionary<AIProviderId, ProviderUsageLevel>> RefreshMany(IReadOnlyCollection<AIProviderId> providerIds, CancellationToken cancellationToken = default)
    {
        var ids = providerIds.Distinct().ToList();
        var freshness = options.Value.UsageSnapshotFreshness;

        var result = new Dictionary<AIProviderId, ProviderUsageLevel>();
        var stale = new List<AIProviderId>();
        foreach (var providerId in ids)
        {
            var cached = recentSnapshots.Get(providerId, freshness);
            if (cached is not null)
            {
                result[providerId] = cached;
            }
            else
            {
                stale.Add(providerId);
            }
        }

        if (stale.Count == 0)
        {
            return result;
        }

        // The package resolves a provider by its own AIProviderId, structurally identical to
        // Direct's own (both wrap a Guid) but nominally distinct - convert at the boundary rather
        // than merging the two identities, since Direct's own AIProviderId is what every other
        // reader of a provider's usage level (pool selection, the Settings panel) already keys by.
        var reports = await usageReporting.ForMany([.. stale.Select(id => (PackageAIProviderId)id.Value)], options.Value.UsageReportTimeout);

        // The local-burn fallback is asked at most once per refresh, no matter how many stale
        // providers need it - every provider's trailing-week burn comes back in one call.
        ProviderBurnOverTrailingWeek? burn = null;

        foreach (var providerId in stale)
        {
            var report = reports.GetValueOrDefault((PackageAIProviderId)providerId.Value) ?? new AIProviderUsageReport((PackageAIProviderId)providerId.Value, AIUsageReportAvailability.Unreachable, [], []);
            var provider = await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
            var ceiling = provider?.UsageCapacity;

            long consumedTokens;
            var usedLocalBurnFallback = report.Availability != AIUsageReportAvailability.Available;
            if (usedLocalBurnFallback)
            {
                burn ??= await providerBurn.TrailingWeek(cancellationToken);
                consumedTokens = burn.Tokens.GetValueOrDefault(providerId, 0L);
            }
            else
            {
                consumedTokens = report.TokenUsage.Sum(day => day.UncachedInputTokens + day.CacheCreationTokens + day.CacheReadTokens + day.OutputTokens);
            }

            var level = new ProviderUsageLevel(report.Availability, consumedTokens, usedLocalBurnFallback, ceiling);
            recentSnapshots.Record(providerId, level);
            result[providerId] = level;

            await RecordSnapshot(providerId, level);
        }

        return result;
    }

    async Task RecordSnapshot(AIProviderId providerId, ProviderUsageLevel level)
    {
        try
        {
            await commandPipeline.Execute(new RecordAIProviderUsageSnapshot(providerId, level.Availability, level.ConsumedTokens, level.UsedLocalBurnFallback));
        }
        catch (Exception exception)
        {
            // Losing the audit record is not worth failing the caller's actual selection over - the
            // level itself is already cached and returned above, so the decision this refresh exists
            // for is unaffected.
            logger.CouldNotRecordUsageSnapshot(exception, providerId);
        }
    }
}
