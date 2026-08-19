// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace Planner.Work.Callback;

/// <summary>
/// Issues and validates the per-work-item bearer token a worker container's callbacks authenticate
/// with. A token is minted the moment a worker is dispatched, travels to the container as the
/// <c>PLANNER_CALLBACK_TOKEN</c> environment variable, and is required on every request the
/// container makes back to the Planner - deliberately kept out of the event log (it is a session
/// credential, not a domain fact) and out of any read model, so it never round-trips to a browser.
/// </summary>
/// <param name="timeProvider">The <see cref="TimeProvider"/> tokens expire against.</param>
public class WorkerCallbackTokens(TimeProvider timeProvider) : IWorkerCallbackTokens
{
    static readonly TimeSpan _maxLifetime = TimeSpan.FromHours(12);

    readonly ConcurrentDictionary<WorkId, (string HashHex, DateTimeOffset IssuedAt)> _tokens = new();

    /// <inheritdoc/>
    public CallbackToken Issue(WorkId work)
    {
        Prune();
        var token = CallbackToken.New();
        _tokens[work] = (Hash(token.Value), timeProvider.GetUtcNow());
        return token;
    }

    /// <inheritdoc/>
    public bool Validate(WorkId work, string? presentedToken)
    {
        if (string.IsNullOrEmpty(presentedToken) || !_tokens.TryGetValue(work, out var entry))
        {
            return false;
        }

        if (timeProvider.GetUtcNow() - entry.IssuedAt > _maxLifetime)
        {
            _tokens.TryRemove(work, out _);
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Convert.FromHexString(Hash(presentedToken)),
            Convert.FromHexString(entry.HashHex));
    }

    /// <inheritdoc/>
    public void Revoke(WorkId work) => _tokens.TryRemove(work, out _);

    static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    void Prune()
    {
        var cutoff = timeProvider.GetUtcNow() - _maxLifetime;
        foreach (var (work, entry) in _tokens)
        {
            if (entry.IssuedAt < cutoff)
            {
                _tokens.TryRemove(work, out _);
            }
        }
    }
}
