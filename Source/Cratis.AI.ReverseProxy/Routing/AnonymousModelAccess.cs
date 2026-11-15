// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;
using Microsoft.AspNetCore.Http;

namespace Cratis.AI.ReverseProxy.Routing;

/// <summary>
/// Lets every caller use every endpoint. Only for a proxy that listens on this machine alone, where the person at the keyboard is
/// the only caller; never for one reachable from a network.
/// </summary>
public class AnonymousModelAccess : IModelAccess
{
    /// <inheritdoc/>
    public ValueTask<bool> IsCaller(HttpContext context) => ValueTask.FromResult(true);

    /// <inheritdoc/>
    public ValueTask<bool> Allows(HttpContext context, ModelEndpoint endpoint) => ValueTask.FromResult(true);
}
