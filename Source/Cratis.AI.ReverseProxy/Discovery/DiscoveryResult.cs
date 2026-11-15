// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;
using Cratis.AI.ReverseProxy.Protocols;

namespace Cratis.AI.ReverseProxy.Discovery;

/// <summary>
/// What probing a backend found.
/// </summary>
/// <param name="Reachable">Whether anything answered as a model server.</param>
/// <param name="Protocols">The protocols that answered; callers may add more they know the backend speaks.</param>
/// <param name="Models">The models it lists.</param>
/// <param name="Problem">Why nothing was found, in words a person can act on; empty when something was.</param>
public record DiscoveryResult(bool Reachable, AIProtocol Protocols, IReadOnlyList<ServedModel> Models, string Problem = "")
{
    /// <summary>
    /// Creates the result for a backend that could not be used.
    /// </summary>
    /// <param name="problem">Why.</param>
    /// <returns>The <see cref="DiscoveryResult"/>.</returns>
    public static DiscoveryResult Unreachable(string problem) => new(false, AIProtocol.None, [], problem);
}
