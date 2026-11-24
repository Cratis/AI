// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Captures reusable boundary facts without provider calls, refreshes, read-model I/O or waiting for reads.
/// </summary>
public interface IAIProviderCapacitySnapshots
{
    /// <summary>
    /// Copies the actual provider's cached allowance. A cold cache honestly reports unavailable.
    /// </summary>
    /// <param name="provider">The actual selected provider, not an agent's preference.</param>
    /// <returns>An event-safe historical snapshot.</returns>
    AIProviderCapacitySnapshot Capture(AIProviderId provider);
}

/// <summary>
/// The cache-only <see cref="IAIProviderCapacitySnapshots"/> implementation, discovered by convention.
/// </summary>
/// <param name="observations">The existing shared observation cache.</param>
/// <param name="timeProvider">The boundary clock.</param>
/// <param name="options">The observation freshness policy.</param>
/// <param name="logger">The logger for sanitized cache failures.</param>
public class AIProviderCapacitySnapshots(IAIProviderCapacityObservations observations, TimeProvider timeProvider, IOptions<AIProviderOptions> options, ILogger<AIProviderCapacitySnapshots>? logger = null) : IAIProviderCapacitySnapshots
{
    /// <inheritdoc/>
    public AIProviderCapacitySnapshot Capture(AIProviderId provider)
    {
        var now = timeProvider.GetUtcNow();
        try
        {
            return CaptureCached(provider, now);
        }
        catch (Exception)
        {
            AIProviderCapacitySnapshotsLogging.CaptureFailed(logger ?? NullLogger<AIProviderCapacitySnapshots>.Instance, provider);
            return AIProviderCapacitySnapshot.Unavailable(provider, now, AIProviderCapacitySnapshotReason.CaptureFailed);
        }
    }

    AIProviderCapacitySnapshot CaptureCached(AIProviderId provider, DateTimeOffset now)
    {
        if (provider == AIProviderId.NotSet)
        {
            return AIProviderCapacitySnapshot.Unavailable(provider, now, AIProviderCapacitySnapshotReason.ProviderNotResolved);
        }

        if (observations is not IAIProviderCapacityObservationView view)
        {
            return AIProviderCapacitySnapshot.Unavailable(provider, now, AIProviderCapacitySnapshotReason.CacheNotSupported);
        }

        if (view.ReadCached(provider) is not { } cached)
        {
            return AIProviderCapacitySnapshot.Unavailable(provider, now, AIProviderCapacitySnapshotReason.NotObserved);
        }

        var observation = cached.Observation;
        var report = observation.Report;
        if (report.Source == AIProviderCapacitySource.Unknown)
        {
            return AIProviderCapacitySnapshot.Unavailable(provider, now, AIProviderCapacitySnapshotReason.RefreshFailed) with { ObservedAt = observation.ObservedAt };
        }

        var reason = Staleness(cached, now);
        var windows = report.Windows.Select(window => new AIProviderAllowanceWindow(window.Kind, window.Name, window.Remaining, window.ResetsAt ?? AIProviderCapacitySnapshot.UnknownTime)).ToArray();
        return new(provider, report.Source, reason == AIProviderCapacitySnapshotReason.None ? AIProviderCapacitySnapshotState.Available : AIProviderCapacitySnapshotState.Stale, reason, now, observation.ObservedAt, Array.AsReadOnly(windows));
    }

    AIProviderCapacitySnapshotReason Staleness(AIProviderCapacityBoundaryCache.Cached cached, DateTimeOffset now)
    {
        if (cached.Reason != AIProviderCapacitySnapshotReason.None)
        {
            return cached.Reason;
        }

        if (cached.Observation.Report.Windows.Any(window => window.ResetsAt is { } reset && reset <= now))
        {
            return AIProviderCapacitySnapshotReason.ResetElapsed;
        }

        return now - cached.Observation.ObservedAt >= options.Value.CapacityFreshness ? AIProviderCapacitySnapshotReason.Expired : AIProviderCapacitySnapshotReason.None;
    }
}
