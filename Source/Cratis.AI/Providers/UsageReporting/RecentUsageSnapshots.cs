// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using System.Diagnostics.Metrics;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using Cratis.AI.Providers.UsageReporting.Snapshots;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// Defines the in-process freshness cache <see cref="IProviderUsageLevels"/> reuses a provider's
/// last-refreshed usage level from, so a burst of tasks against the same pool does not each spend a
/// vendor Admin API call re-discovering the same numbers (issue #1061). The same operational-memory
/// choice <see cref="Pools.IRecentProviderFailures"/> already makes: this is read-your-writes cache
/// state, not a domain fact. Readings are reported as metrics and retained only in memory;
/// restarting the process clears them. No usage snapshot event is appended.
/// </summary>
public interface IRecentUsageSnapshots
{
    /// <summary>
    /// Observes the latest readings regardless of freshness, including the current set on subscribe.
    /// Dispose the subscription to stop observing.
    /// </summary>
    /// <returns>The process-wide readings; callers must filter them to their namespace.</returns>
    IObservable<IEnumerable<AIProviderUsageSnapshot>> Observe();

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
[Singleton]
public class RecentUsageSnapshots : IRecentUsageSnapshots, IDisposable
{
    /// <summary>
    /// The meter reporting provider usage readings.
    /// </summary>
    public const string MeterName = "Cratis.AI.Providers.UsageReporting";

    readonly ConcurrentDictionary<AIProviderId, (DateTimeOffset RecordedAt, ProviderUsageLevel Level)> _levels = new();
    readonly BehaviorSubject<IEnumerable<AIProviderUsageSnapshot>> _snapshots = new([]);
    readonly object _gate = new();
    readonly TimeProvider _timeProvider;
    readonly Meter _meter = new(MeterName);

    /// <summary>
    /// Initializes a new instance of the <see cref="RecentUsageSnapshots"/> class.
    /// </summary>
    /// <param name="timeProvider">The clock for readings and freshness.</param>
    public RecentUsageSnapshots(TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
        _meter.CreateObservableGauge("cratis.ai.provider.consumed_tokens", Measurements, unit: "{token}");
    }

    /// <inheritdoc/>
    public IObservable<IEnumerable<AIProviderUsageSnapshot>> Observe() => _snapshots.AsObservable();

    /// <inheritdoc/>
    public ProviderUsageLevel? Get(AIProviderId providerId, TimeSpan freshnessWindow)
    {
        if (_levels.TryGetValue(providerId, out var entry) && _timeProvider.GetUtcNow() - entry.RecordedAt < freshnessWindow)
        {
            return entry.Level;
        }

        return null;
    }

    /// <inheritdoc/>
    public void Record(AIProviderId providerId, ProviderUsageLevel level)
    {
        lock (_gate)
        {
            _levels[providerId] = (_timeProvider.GetUtcNow(), level);
            _snapshots.OnNext(_levels.Select(entry => new AIProviderUsageSnapshot(
                entry.Key,
                entry.Value.Level.Availability,
                entry.Value.Level.ConsumedTokens,
                entry.Value.Level.UsedLocalBurnFallback,
                entry.Value.RecordedAt)).ToArray());
        }
    }

    /// <inheritdoc/>
    public void Dispose()
    {
        _meter.Dispose();
        _snapshots.Dispose();
    }

    IEnumerable<Measurement<long>> Measurements() => _levels.Select(entry => new Measurement<long>(
        entry.Value.Level.ConsumedTokens,
        new KeyValuePair<string, object?>("provider", entry.Key.Value.ToString()),
        new KeyValuePair<string, object?>("availability", entry.Value.Level.Availability.ToString())));
}
