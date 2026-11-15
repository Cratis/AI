// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Immutable;
using Cratis.AI.ReverseProxy.Protocols;
using Microsoft.Extensions.Primitives;

namespace Cratis.AI.ReverseProxy.Endpoints;

/// <summary>
/// An in-memory <see cref="IModelEndpoints"/>. Reads take a snapshot and never block a change.
/// </summary>
public sealed class ModelEndpoints : IModelEndpoints, IDisposable
{
    readonly Lock _lock = new();
    ImmutableSortedDictionary<string, ModelEndpoint> _endpoints = ImmutableSortedDictionary.Create<string, ModelEndpoint>(StringComparer.Ordinal);
    CancellationTokenSource _changed = new();

    /// <inheritdoc/>
    public IReadOnlyList<ModelEndpoint> All => [.. _endpoints.Values];

    static void Validate(ModelEndpoint endpoint)
    {
        if (!ModelEndpoint.IsValidId(endpoint.Id))
        {
            throw new ArgumentException($"'{endpoint.Id}' is not a valid endpoint identity: use 1 to 63 lowercase letters, digits or hyphens", nameof(endpoint));
        }
    }

    static bool Same(ImmutableSortedDictionary<string, ModelEndpoint> left, ImmutableSortedDictionary<string, ModelEndpoint> right) =>
        left.Count == right.Count &&
        left.All(pair => right.TryGetValue(pair.Key, out var other) && Equivalent(pair.Value, other));

    static bool Equivalent(ModelEndpoint left, ModelEndpoint right) =>
        left.Name == right.Name && left.BaseUrl == right.BaseUrl && left.Protocols == right.Protocols && left.ApiKey == right.ApiKey &&
        left.Models.SequenceEqual(right.Models);

    /// <inheritdoc/>
    public void Dispose() => _changed.Dispose();

    /// <inheritdoc/>
    public IChangeToken GetChangeToken()
    {
        lock (_lock)
        {
            return new CancellationChangeToken(_changed.Token);
        }
    }

    /// <inheritdoc/>
    public ModelEndpoint? Find(string id) => _endpoints.GetValueOrDefault(id);

    /// <inheritdoc/>
    public ModelEndpoint? FindForModel(string model, AIProtocol protocol) =>
        _endpoints.Values.FirstOrDefault(endpoint => endpoint.Protocols.HasFlag(protocol) && endpoint.Serves(model));

    /// <inheritdoc/>
    public void Set(ModelEndpoint endpoint)
    {
        Validate(endpoint);
        Change(endpoints => endpoints.SetItem(endpoint.Id, endpoint));
    }

    /// <inheritdoc/>
    public bool Remove(string id)
    {
        var removed = false;
        Change(endpoints =>
        {
            removed = endpoints.ContainsKey(id);
            return endpoints.Remove(id);
        });
        return removed;
    }

    /// <inheritdoc/>
    public void ReplaceAll(IEnumerable<ModelEndpoint> endpoints)
    {
        var next = endpoints.ToArray();
        foreach (var endpoint in next)
        {
            Validate(endpoint);
        }

        Change(_ => ImmutableSortedDictionary.CreateRange(StringComparer.Ordinal, next.Select(endpoint => KeyValuePair.Create(endpoint.Id, endpoint))));
    }

    void Change(Func<ImmutableSortedDictionary<string, ModelEndpoint>, ImmutableSortedDictionary<string, ModelEndpoint>> change)
    {
        CancellationTokenSource previous;
        lock (_lock)
        {
            var next = change(_endpoints);
            if (ReferenceEquals(next, _endpoints) || Same(next, _endpoints))
            {
                return;
            }

            _endpoints = next;
            previous = _changed;
            _changed = new();
        }

        previous.Cancel();
        previous.Dispose();
    }
}
