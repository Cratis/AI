// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// Remembers the most recent <see cref="AIProviderQuotaStatus"/> each provider's own responses
/// reported, so a pool dispatch can skip a provider already known to be exhausted instead of
/// learning that the hard way through a 429 (Cratis/AI#337). Every <see cref="IAIProviderClient"/>
/// reports into this after every call; <see cref="AIProviderPoolDispatcher"/> is the reader.
/// </summary>
public interface IAIProviderQuotaTracker
{
    /// <summary>
    /// Records what a provider's response just reported about its own remaining quota - a no-op
    /// when the vendor's headers carried nothing <see cref="AIProviderQuotaHeaders"/> could read.
    /// </summary>
    /// <param name="providerId">The provider the response came from.</param>
    /// <param name="type">The vendor - which header shape to read.</param>
    /// <param name="response">The response to read quota headers from.</param>
    void Report(AIProviderId providerId, AIProviderType type, HttpResponseMessage response);

    /// <summary>
    /// Gets the most recently reported <see cref="AIProviderQuotaStatus"/> for a provider.
    /// </summary>
    /// <param name="providerId">The provider.</param>
    /// <returns>The status, or <see langword="null"/> when nothing has been reported for it yet.</returns>
    AIProviderQuotaStatus? KnownQuotaFor(AIProviderId providerId);

    /// <summary>
    /// Whether a provider is known, right now, to have nothing left to spend.
    /// </summary>
    /// <param name="providerId">The provider.</param>
    /// <returns><see langword="true"/> only when a status has been reported and it says so - a provider nothing has been reported for is never treated as exhausted.</returns>
    bool IsKnownExhausted(AIProviderId providerId);
}

/// <summary>
/// An in-memory <see cref="IAIProviderQuotaTracker"/> - process-local, which is the right scope: the
/// quota a vendor reports is a live fact about the last call this process made, not something worth
/// persisting or sharing across replicas, and a stale cross-replica read would be actively worse than
/// the concurrency gate and trailing-week burn figures <see cref="AIProviderPoolDispatcher"/> already
/// combines this with.
/// </summary>
/// <param name="timeProvider">The <see cref="TimeProvider"/> exhaustion is judged against.</param>
public class AIProviderQuotaTracker(TimeProvider timeProvider) : IAIProviderQuotaTracker
{
    readonly ConcurrentDictionary<AIProviderId, AIProviderQuotaStatus> _quotas = new();

    /// <inheritdoc/>
    public void Report(AIProviderId providerId, AIProviderType type, HttpResponseMessage response)
    {
        if (AIProviderQuotaHeaders.Read(type, response) is { } status)
        {
            _quotas[providerId] = status;
        }
    }

    /// <inheritdoc/>
    public AIProviderQuotaStatus? KnownQuotaFor(AIProviderId providerId) =>
        _quotas.TryGetValue(providerId, out var status) ? status : null;

    /// <inheritdoc/>
    public bool IsKnownExhausted(AIProviderId providerId) =>
        KnownQuotaFor(providerId) is { } status && status.IsExhausted(timeProvider);
}
