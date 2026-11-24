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
    /// <param name="credential">The credential the read is made with, when it is known. A different one from the last read discards everything remembered about the provider: a new credential can reach another account, so what the old one saw says nothing about it - on every instance, not just the one that handled the change.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>
    /// The observation. When a read fails, the last good observation is served instead, carrying the
    /// new problem and its own original <see cref="AIProviderCapacityObservation.ObservedAt"/>; with
    /// no good observation to fall back on, the failure itself is.
    /// </returns>
    Task<AIProviderCapacityObservation> Observe(AIProviderId provider, Func<CancellationToken, Task<AIProviderCapacityReport>> read, string? credential = null, CancellationToken cancellationToken = default);

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
public class AIProviderCapacityObservations(TimeProvider timeProvider, IOptions<AIProviderOptions> options) : IAIProviderCapacityObservations, IAIProviderCapacityObservationView
{
    static readonly TimeSpan _maximumBackOff = TimeSpan.FromHours(1);

    readonly ConcurrentDictionary<AIProviderId, Entry> _entries = new();
    readonly ConcurrentDictionary<AIProviderId, string> _fingerprints = new();
    readonly ConcurrentDictionary<AIProviderId, Lazy<Task<Entry>>> _reading = new();

    /// <summary>
    /// Gets the independent cache-only publication view on this singleton.
    /// </summary>
    internal AIProviderCapacityBoundaryCache Boundaries { get; } = new();

    /// <inheritdoc/>
    AIProviderCapacityBoundaryCache.Cached? IAIProviderCapacityObservationView.ReadCached(AIProviderId provider) => Boundaries.Read(provider);

    /// <inheritdoc/>
    public Task<AIProviderCapacityObservation> Observe(AIProviderId provider, Func<CancellationToken, Task<AIProviderCapacityReport>> read, string? credential = null, CancellationToken cancellationToken = default)
        => ObserveSelected(provider, read, credential, Boundaries.Begin(provider, credential), cancellationToken);

    /// <summary>
    /// Uses the ordinary vendor cache while retaining the outer query's publication version.
    /// </summary>
    /// <param name="provider">The actual provider.</param>
    /// <param name="read">The ordinary vendor reader.</param>
    /// <param name="credential">The selected credentials.</param>
    /// <param name="ticket">The boundary publication ticket.</param>
    /// <param name="cancellationToken">The caller's cancellation token.</param>
    /// <returns>The unchanged ordinary observation result.</returns>
    internal async Task<AIProviderCapacityObservation> ObserveSelected(AIProviderId provider, Func<CancellationToken, Task<AIProviderCapacityReport>> read, string? credential, AIProviderCapacityBoundaryCache.Ticket ticket, CancellationToken cancellationToken)
    {
        UpdateCredential(provider, credential);
        var now = timeProvider.GetUtcNow();
        Entry entry;
        if (_entries.TryGetValue(provider, out var cached) && cached.CanServe(now, options.Value.CapacityFreshness))
        {
            entry = cached;
        }
        else
        {
            // A new-account caller may join an old-account read and receive its result, but it is not cached.
            var reading = _reading.GetOrAdd(
                provider,
                static (key, state) => new(() => state.Observations.ReadAndRemember(key, state.Read, state.Ticket)),
                (Observations: this, Read: read, Ticket: ticket));
            entry = await reading.Value.WaitAsync(cancellationToken);
        }

        var reason = entry.Failure is not null ? AIProviderCapacitySnapshotReason.RefreshFailed
            : entry.Stale ? AIProviderCapacitySnapshotReason.Invalidated : AIProviderCapacitySnapshotReason.None;
        if (ticket.Generation == entry.Generation)
        {
            Boundaries.Remember(ticket, entry.Serve(), reason, entry.Credential);
        }

        return entry.Serve();
    }

    void UpdateCredential(AIProviderId provider, string? credential)
    {
        if (credential is null)
        {
            return;
        }

        var fingerprint = AIProviderCapacityBoundaryCache.Fingerprint(credential);
        if (_fingerprints.TryGetValue(provider, out var known) && known != fingerprint)
        {
            _entries.TryRemove(provider, out _);
        }

        _fingerprints[provider] = fingerprint;
    }

    /// <inheritdoc/>
    public void Forget(AIProviderId provider)
    {
        // Revoke pending writes before marking the retained entry stale.
        Boundaries.Invalidate(provider);
        _entries.AddOrUpdate(provider, static _ => new Entry { Stale = true }, static (_, entry) => entry with { Stale = true });
    }

    async Task<Entry> ReadAndRemember(AIProviderId provider, Func<CancellationToken, Task<AIProviderCapacityReport>> read, AIProviderCapacityBoundaryCache.Ticket ticket)
    {
        var fingerprint = ticket.Fingerprint;
        try
        {
            AIProviderCapacityReport report;
            try
            {
                report = await read(CancellationToken.None);
            }
            catch (Exception exception) when (exception is HttpRequestException or System.Text.Json.JsonException)
            {
                // Vendor messages, including inner exceptions, may contain credentials or response bodies.
                var failure = exception is HttpRequestException { StatusCode: { } status }
                    ? $"{exception.GetType().Name} (HTTP {(int)status})"
                    : exception.GetType().Name;
                report = AIProviderCapacityReport.Unavailable($"The usage read failed: {failure}");
            }

            var now = timeProvider.GetUtcNow();
            var observation = new AIProviderCapacityObservation(report, now);
            if (!report.Failed)
            {
                var good = new Entry { LastGood = observation, GoodCredential = fingerprint, Generation = ticket.Generation };
                Remember(provider, ticket, good);
                return good;
            }

            var previous = _entries.GetValueOrDefault(provider);
            var failures = (previous?.Failures ?? 0) + 1;
            var updated = (previous ?? new Entry()) with
            {
                Failure = observation,
                FailureCredential = fingerprint,
                Generation = ticket.Generation,
                Failures = failures,
                BackOffUntil = now + BackOff(failures)
            };
            Remember(provider, ticket, updated);
            return updated;
        }
        finally
        {
            _reading.TryRemove(provider, out _);
        }
    }

    void Remember(AIProviderId provider, AIProviderCapacityBoundaryCache.Ticket ticket, Entry entry)
    {
        lock (ticket.Slot.Gate)
        {
            // Unlike boundary publication, shared vendor reads survive newer selections of the same account.
            if (ticket.Fingerprint == ticket.Slot.Fingerprint && ticket.Generation == ticket.Slot.Generation)
            {
                _entries[provider] = entry;
            }
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

    sealed record Entry
    {
        public AIProviderCapacityObservation? LastGood { get; init; }
        public AIProviderCapacityObservation? Failure { get; init; }
        public string? GoodCredential { get; init; }
        public string? FailureCredential { get; init; }
        public int Failures { get; init; }
        public long Generation { get; init; }
        public DateTimeOffset BackOffUntil { get; init; } = DateTimeOffset.MinValue;
        public bool Stale { get; init; }
        public string? Credential => LastGood is not null ? GoodCredential : FailureCredential;

        public bool CanServe(DateTimeOffset now, TimeSpan freshness) => IsFresh(now, freshness) || BackOffUntil > now;

        bool IsFresh(DateTimeOffset now, TimeSpan freshness) => !Stale && Failure is null && LastGood is { } good && now - good.ObservedAt < freshness;

        public AIProviderCapacityObservation Serve() => (LastGood, Failure) switch
        {
            ({ } good, { } failure) => good with { Report = good.Report with { Problem = failure.Report.Problem } },
            ({ } good, null) => good,
            (null, { } failure) => failure,
            _ => new(AIProviderCapacityReport.Unavailable("Nothing has been read yet"), DateTimeOffset.MinValue)
        };
    }
}
