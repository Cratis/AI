// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Types;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Decisions.Health;

/// <summary>
/// Reports whether the decision engine in force can answer right now.
/// </summary>
public interface IDecisionEngineHealth
{
    /// <summary>
    /// Checks the engine currently in force, reusing a recent result.
    /// </summary>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="DecisionEngineProbe"/>.</returns>
    Task<DecisionEngineProbe> Current(CancellationToken cancellationToken = default);
}

/// <summary>
/// Represents an implementation of <see cref="IDecisionEngineHealth"/>.
/// </summary>
/// <param name="resolver">Resolves the engine in force.</param>
/// <param name="clients">The convention-discovered engine clients.</param>
/// <param name="cache">The results of recent checks.</param>
/// <param name="options">The <see cref="DecisionOptions"/>.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/>.</param>
public class DecisionEngineHealth(
    IDecisionEngineResolver resolver,
    IInstancesOf<IDecisionEngineClient> clients,
    DecisionEngineHealthCache cache,
    IOptions<DecisionOptions> options,
    TimeProvider timeProvider) : IDecisionEngineHealth
{
    /// <inheritdoc/>
    public async Task<DecisionEngineProbe> Current(CancellationToken cancellationToken = default)
    {
        var connection = await resolver.Resolve(cancellationToken);
        if (connection is null)
        {
            return DecisionEngineProbe.Unreachable("No decision engine is available");
        }

        var now = timeProvider.GetUtcNow();
        if (cache.TryGet(connection, now - options.Value.HealthCheckInterval, out var cached))
        {
            return cached;
        }

        var client = clients.FirstOrDefault(_ => _.Type == connection.Type);
        var probe = client is null
            ? DecisionEngineProbe.Unreachable($"There is no client for the {connection.Type} decision engine")
            : await ProbeWithin(client, connection, cancellationToken);

        cache.Set(connection, probe, now);

        return probe;
    }

    async Task<DecisionEngineProbe> ProbeWithin(IDecisionEngineClient client, DecisionEngineConnection connection, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(options.Value.Timeout);

        return await client.Probe(connection, timeout.Token);
    }
}

/// <summary>
/// Holds the result of the most recent health check per engine, so a polling settings page does not
/// turn into a stream of round trips to the engine.
/// </summary>
/// <remarks>
/// A singleton holding plain values only - the scoped collaborators that produce them stay scoped.
/// Keyed by the whole connection, so reconfiguring the engine is never answered from a check of the
/// previous configuration.
/// </remarks>
public class DecisionEngineHealthCache
{
    readonly Lock _lock = new();
    readonly Dictionary<DecisionEngineConnection, (DecisionEngineProbe Probe, DateTimeOffset CheckedAt)> _results = [];

    /// <summary>
    /// Gets a cached result that is newer than the given point in time.
    /// </summary>
    /// <param name="connection">The engine the result is for.</param>
    /// <param name="notOlderThan">The oldest result that may be reused.</param>
    /// <param name="probe">The cached result, when there is one.</param>
    /// <returns><see langword="true"/> when a result could be reused.</returns>
    public bool TryGet(DecisionEngineConnection connection, DateTimeOffset notOlderThan, out DecisionEngineProbe probe)
    {
        lock (_lock)
        {
            if (_results.TryGetValue(connection, out var entry) && entry.CheckedAt > notOlderThan)
            {
                probe = entry.Probe;
                return true;
            }
        }

        probe = DecisionEngineProbe.Unreachable(string.Empty);
        return false;
    }

    /// <summary>
    /// Records the result of a check.
    /// </summary>
    /// <param name="connection">The engine the result is for.</param>
    /// <param name="probe">The result.</param>
    /// <param name="checkedAt">When the check was made.</param>
    public void Set(DecisionEngineConnection connection, DecisionEngineProbe probe, DateTimeOffset checkedAt)
    {
        lock (_lock)
        {
            _results[connection] = (probe, checkedAt);
        }
    }
}
