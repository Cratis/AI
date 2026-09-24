// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// Defines the in-process memory of which providers have failed a real call recently - the failure
/// side of the same "which provider is actually available" question <see cref="IProviderBurn"/>
/// answers from usage. <see cref="PoolMemberSelector"/> reads this to stop ranking a provider that
/// fails every call first forever just because it has never burnt a token succeeding.
/// </summary>
/// <remarks>
/// Deliberately in-memory rather than event-sourced, the same choice <c>IDispatchedWorkMemory</c> and
/// <c>IScheduledIssueMemory</c> already make: this is operational read-your-writes state about the
/// last few minutes, not a domain fact worth an audit trail. A restart losing it costs nothing more
/// than one pass' worth of ranking accuracy - every provider starts clean again, exactly as it should
/// once nobody remembers it having ever failed.
/// </remarks>
public interface IRecentProviderFailures
{
    /// <summary>
    /// Records that a provider's real call just failed transiently or permanently - called by
    /// <see cref="PoolDispatcher.Dispatch{T}"/> for every member a real attempt failed on.
    /// </summary>
    /// <param name="providerId">The provider that failed.</param>
    void Record(AIProviderId providerId);

    /// <summary>
    /// Counts how many times each provider has failed within a trailing window.
    /// </summary>
    /// <param name="window">How far back to count from now.</param>
    /// <returns>Failure counts, keyed by provider - a provider missing from the map has failed none.</returns>
    IReadOnlyDictionary<AIProviderId, int> CountsSince(TimeSpan window);
}

/// <summary>
/// The default <see cref="IRecentProviderFailures"/>, keeping one failure timestamp queue per
/// provider and trimming it lazily as it is read.
/// </summary>
/// <param name="timeProvider">The <see cref="TimeProvider"/> the trailing window is measured against.</param>
[Singleton]
public class RecentProviderFailures(TimeProvider timeProvider) : IRecentProviderFailures
{
    readonly ConcurrentDictionary<AIProviderId, ConcurrentQueue<DateTimeOffset>> _failures = new();

    /// <inheritdoc/>
    public void Record(AIProviderId providerId) =>
        _failures.GetOrAdd(providerId, static _ => new()).Enqueue(timeProvider.GetUtcNow());

    /// <inheritdoc/>
    public IReadOnlyDictionary<AIProviderId, int> CountsSince(TimeSpan window)
    {
        var cutoff = timeProvider.GetUtcNow() - window;
        var counts = new Dictionary<AIProviderId, int>();

        foreach (var (provider, timestamps) in _failures)
        {
            while (timestamps.TryPeek(out var oldest) && oldest < cutoff)
            {
                timestamps.TryDequeue(out _);
            }

            if (!timestamps.IsEmpty)
            {
                counts[provider] = timestamps.Count;
            }
        }

        return counts;
    }
}
