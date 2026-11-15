// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;
using Microsoft.AspNetCore.Http;

namespace Cratis.AI.ReverseProxy.Routing;

/// <summary>
/// The access in force until the host application registers its own: nobody is let in.
/// </summary>
public class DenyModelAccess : IModelAccess
{
    /// <inheritdoc/>
    public ValueTask<bool> IsCaller(HttpContext context) => ValueTask.FromResult(false);

    /// <inheritdoc/>
    public ValueTask<bool> Allows(HttpContext context, ModelEndpoint endpoint) => ValueTask.FromResult(false);
}
