// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;
using Microsoft.AspNetCore.Http;

namespace Cratis.AI.ReverseProxy.Routing;

/// <summary>
/// Decides who may use the proxy and which endpoints each caller may reach. The proxy hands a request to a machine somebody
/// owns, so the host application must say yes explicitly: nothing is allowed by default.
/// </summary>
public interface IModelAccess
{
    /// <summary>
    /// Whether the request comes from a caller that may use the proxy at all. Asked first, before anything is revealed about
    /// which models exist.
    /// </summary>
    /// <param name="context">The request.</param>
    /// <returns>True when the caller is authenticated as someone allowed to call the proxy.</returns>
    ValueTask<bool> IsCaller(HttpContext context);

    /// <summary>
    /// Whether the caller may use an endpoint.
    /// </summary>
    /// <param name="context">The request.</param>
    /// <param name="endpoint">The <see cref="ModelEndpoint"/>.</param>
    /// <returns>True when it may.</returns>
    ValueTask<bool> Allows(HttpContext context, ModelEndpoint endpoint);
}
