// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// Defines the in-process freshness cache <see cref="IProviderUsageLevels"/> reuses a provider's
/// last-refreshed usage level from, so a burst of tasks against the same pool does not each spend a
/// vendor Admin API call re-discovering the same numbers (issue #1061). The same operational-memory
/// choice <see cref="Pools.IRecentProviderFailures"/> already makes: this is read-your-writes cache
/// state about the last few minutes, not a domain fact worth an audit trail on its own - the durable
/// record of a level is the <see cref="RecordingSnapshot.AIProviderUsageSnapshotRecorded"/> event this
/// cache is refreshed alongside, not this cache itself.
/// </summary>
public interface IRecentUsageSnapshots
{
    /// <summary>
    /// Gets a provider's cached usage level, when one was recorded within the given freshness window.
    /// </summary>
    /// <param name="providerId">The provider to look up.</param>
    /// <param name="freshnessWindow">How recently the level must have been recorded to still be trusted.</param>
    /// <returns>The cached level, or <see langword="null"/> when there is none or it has gone stale.</returns>
    ProviderUsageLevel? Get(AIProviderId providerId, TimeSpan freshnessWindow);

    /// <summary>
    /// Records a provider's freshly refreshed usage level.
    /// </summary>
    /// <param name="providerId">The provider the level was refreshed for.</param>
    /// <param name="level">The level.</param>
    void Record(AIProviderId providerId, ProviderUsageLevel level);
}

/// <summary>
/// The default <see cref="IRecentUsageSnapshots"/>, keeping one entry per provider.
/// </summary>
/// <param name="timeProvider">The <see cref="TimeProvider"/> the freshness window is measured against.</param>
[Singleton]
public class RecentUsageSnapshots(TimeProvider timeProvider) : IRecentUsageSnapshots
{
    readonly ConcurrentDictionary<AIProviderId, (DateTimeOffset RecordedAt, ProviderUsageLevel Level)> _levels = new();

    /// <inheritdoc/>
    public ProviderUsageLevel? Get(AIProviderId providerId, TimeSpan freshnessWindow)
    {
        if (_levels.TryGetValue(providerId, out var entry) && timeProvider.GetUtcNow() - entry.RecordedAt < freshnessWindow)
        {
            return entry.Level;
        }

        return null;
    }

    /// <inheritdoc/>
    public void Record(AIProviderId providerId, ProviderUsageLevel level) =>
        _levels[providerId] = (timeProvider.GetUtcNow(), level);
}
