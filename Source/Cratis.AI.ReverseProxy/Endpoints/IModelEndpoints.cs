// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Protocols;
using Microsoft.Extensions.Primitives;

namespace Cratis.AI.ReverseProxy.Endpoints;

/// <summary>
/// The endpoints the proxy can reach right now. It changes while the proxy runs - a machine connects, a model is
/// pulled - and the proxy's routes follow.
/// </summary>
public interface IModelEndpoints
{
    /// <summary>
    /// Gets every endpoint, ordered by identity.
    /// </summary>
    IReadOnlyList<ModelEndpoint> All { get; }

    /// <summary>
    /// Gets a token that signals when <see cref="All"/> has changed.
    /// </summary>
    /// <returns>The <see cref="IChangeToken"/>.</returns>
    IChangeToken GetChangeToken();

    /// <summary>
    /// Finds an endpoint by identity.
    /// </summary>
    /// <param name="id">The identity.</param>
    /// <returns>The endpoint, or null.</returns>
    ModelEndpoint? Find(string id);

    /// <summary>
    /// Finds the endpoint that serves a model over a protocol. When several do, the one with the lowest identity wins, so the
    /// answer does not flap as endpoints connect.
    /// </summary>
    /// <param name="model">The model name.</param>
    /// <param name="protocol">The protocol the caller speaks.</param>
    /// <returns>The endpoint, or null.</returns>
    ModelEndpoint? FindForModel(string model, AIProtocol protocol);

    /// <summary>
    /// Adds an endpoint or replaces the one with the same identity.
    /// </summary>
    /// <param name="endpoint">The <see cref="ModelEndpoint"/>.</param>
    void Set(ModelEndpoint endpoint);

    /// <summary>
    /// Removes an endpoint.
    /// </summary>
    /// <param name="id">The identity.</param>
    /// <returns>True when there was one.</returns>
    bool Remove(string id);

    /// <summary>
    /// Replaces every endpoint with exactly the ones given - one change, however many differ.
    /// </summary>
    /// <param name="endpoints">What the proxy should now reach.</param>
    void ReplaceAll(IEnumerable<ModelEndpoint> endpoints);
}
