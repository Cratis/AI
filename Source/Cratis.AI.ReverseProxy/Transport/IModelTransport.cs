// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;

namespace Cratis.AI.ReverseProxy.Transport;

/// <summary>
/// Carries one HTTP request to the backend of a <see cref="ModelEndpoint"/> and brings the answer back. This is what makes
/// the proxy usable both next to the model (<see cref="DirectModelTransport"/>) and far from it, through a tunnel to the
/// machine that has the model.
/// </summary>
public interface IModelTransport
{
    /// <summary>
    /// Sends a request. The response must be returned as soon as its headers are known, with the body streaming, so server-sent
    /// events reach the caller as the model produces them.
    /// </summary>
    /// <param name="endpoint">The endpoint the request is for.</param>
    /// <param name="request">The request. Its URI path and query are what the backend should receive; its host is the proxy's own.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/>.</param>
    /// <returns>The backend's response.</returns>
    Task<HttpResponseMessage> Send(ModelEndpoint endpoint, HttpRequestMessage request, CancellationToken cancellationToken);
}
