// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using Cratis.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Defines the in-process memory of what each provider's vendor last reported about its allowance -
/// so a burst of dispatches does not each ask a vendor surface that answers 429 readily, and so a
/// vendor that stops answering is backed off from rather than hammered.
/// </summary>
/// <remarks>
/// Operational memory about the last few minutes, the same choice
/// <see cref="UsageReporting.IRecentUsageSnapshots"/> makes - not a domain fact worth an event. Keyed
/// by <see cref="AIProviderId"/>, which is globally unique, so one tenant's observation is never
/// served for another tenant's provider.
/// </remarks>
public interface IAIProviderCapacityObservations
{
    /// <summary>
    /// Gets a provider's observation - the cached one while it is fresh, otherwise a new read.
    /// </summary>
    /// <param name="provider">The provider.</param>
    /// <param name="read">Reads the provider's allowance from its vendor. May throw <see cref="HttpRequestException"/> or <see cref="System.Text.Json.JsonException"/>.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>
    /// The observation. When a read fails, the last good observation is served instead, carrying the
    /// new problem and its own original <see cref="AIProviderCapacityObservation.ObservedAt"/>; with
    /// no good observation to fall back on, the failure itself is.
    /// </returns>
    Task<AIProviderCapacityObservation> Observe(AIProviderId provider, Func<CancellationToken, Task<AIProviderCapacityReport>> read, CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks a provider's observation stale, so the next <see cref="Observe"/> reads it again - for
    /// when the provider has just turned work away over its own limit. The last good observation is
    /// kept to fall back on, and a back-off in force stays in force.
    /// </summary>
    /// <param name="provider">The provider.</param>
    void Forget(AIProviderId provider);
}

/// <summary>
/// The default <see cref="IAIProviderCapacityObservations"/>.
/// </summary>
/// <param name="timeProvider">The <see cref="TimeProvider"/> freshness and back-off are measured against.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> freshness and back-off come from.</param>
[Singleton]
public class AIProviderCapacityObservations(TimeProvider timeProvider, IOptions<AIProviderOptions> options) : IAIProviderCapacityObservations
{
    static readonly TimeSpan _maximumBackOff = TimeSpan.FromHours(1);

    readonly ConcurrentDictionary<AIProviderId, Entry> _entries = new();
    readonly ConcurrentDictionary<AIProviderId, Lazy<Task<AIProviderCapacityObservation>>> _reading = new();

    /// <inheritdoc/>
    public Task<AIProviderCapacityObservation> Observe(AIProviderId provider, Func<CancellationToken, Task<AIProviderCapacityReport>> read, CancellationToken cancellationToken = default)
    {
        var now = timeProvider.GetUtcNow();
        if (_entries.TryGetValue(provider, out var entry))
        {
            if (!entry.Stale && entry.Failure is null && entry.LastGood is { } good && now - good.ObservedAt < options.Value.CapacityFreshness)
            {
                return Task.FromResult(good);
            }

            if (entry.BackOffUntil > now)
            {
                return Task.FromResult(entry.Serve());
            }
        }

        // One read per provider at a time: concurrent callers share it rather than each asking the
        // vendor. The shared read is deliberately not bound to any one caller's token - one caller
        // giving up must not fail the read for the others - and is bounded by the vendor timeout.
        var reading = _reading.GetOrAdd(
            provider,
            static (key, state) => new(() => state.Observations.ReadAndRemember(key, state.Read)),
            (Observations: this, Read: read));
        return reading.Value.WaitAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public void Forget(AIProviderId provider) =>
        _entries.AddOrUpdate(provider, static _ => new Entry(null, null, 0, DateTimeOffset.MinValue, true), static (_, entry) => entry with { Stale = true });

    async Task<AIProviderCapacityObservation> ReadAndRemember(AIProviderId provider, Func<CancellationToken, Task<AIProviderCapacityReport>> read)
    {
        try
        {
            AIProviderCapacityReport report;
            try
            {
                report = await read(CancellationToken.None);
            }
            catch (Exception exception) when (exception is HttpRequestException or System.Text.Json.JsonException)
            {
                // The exception's own message - never the request, which carries the credential.
                report = AIProviderCapacityReport.Unavailable($"The usage read failed: {exception.Message}");
            }

            var now = timeProvider.GetUtcNow();
            var observation = new AIProviderCapacityObservation(report, now);
            if (!report.Failed)
            {
                _entries[provider] = new Entry(observation, null, 0, DateTimeOffset.MinValue, false);
                return observation;
            }

            var previous = _entries.GetValueOrDefault(provider);
            var failures = (previous?.Failures ?? 0) + 1;
            var updated = (previous ?? new Entry(null, null, 0, DateTimeOffset.MinValue, false)) with
            {
                Failure = observation,
                Failures = failures,
                BackOffUntil = now + BackOff(failures)
            };
            _entries[provider] = updated;
            return updated.Serve();
        }
        finally
        {
            _reading.TryRemove(provider, out _);
        }
    }

    TimeSpan BackOff(int failures)
    {
        // Doubling from the freshness window, capped at an hour: an endpoint that 429s is asked a
        // handful of times an hour at most, and recovers within the hour once it answers again.
        var freshness = options.Value.CapacityFreshness;
        var backOff = freshness * Math.Pow(2, Math.Min(failures - 1, 10));
        return backOff > _maximumBackOff ? _maximumBackOff : backOff;
    }

    sealed record Entry(AIProviderCapacityObservation? LastGood, AIProviderCapacityObservation? Failure, int Failures, DateTimeOffset BackOffUntil, bool Stale)
    {
        public AIProviderCapacityObservation Serve() => (LastGood, Failure) switch
        {
            ({ } good, { } failure) => good with { Report = good.Report with { Problem = failure.Report.Problem } },
            ({ } good, null) => good,
            (null, { } failure) => failure,
            _ => new(AIProviderCapacityReport.Unavailable("Nothing has been read yet"), DateTimeOffset.MinValue)
        };
    }
}
