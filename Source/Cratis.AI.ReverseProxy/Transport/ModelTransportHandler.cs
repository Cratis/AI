// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.ReverseProxy.Endpoints;

namespace Cratis.AI.ReverseProxy.Transport;

/// <summary>
/// The handler YARP sends every proxied request through. It looks the endpoint up by the placeholder host and gives the request to
/// the <see cref="IModelTransport"/>, so what the proxy forwards to is decided by the transport, not by DNS.
/// </summary>
/// <param name="endpoints">The <see cref="IModelEndpoints"/>.</param>
/// <param name="transport">The <see cref="IModelTransport"/>.</param>
public class ModelTransportHandler(IModelEndpoints endpoints, IModelTransport transport) : HttpMessageHandler
{
    /// <inheritdoc/>
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.RequestUri is not { } uri || !ModelEndpointHosts.TryGetEndpointId(uri.Host, out var id) || endpoints.Find(id) is not { } endpoint)
        {
            return new HttpResponseMessage(HttpStatusCode.BadGateway) { RequestMessage = request, ReasonPhrase = "The endpoint is no longer available" };
        }

        ModelRequests.Sanitize(request);
        try
        {
            return await transport.Send(endpoint, request, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            return new HttpResponseMessage(HttpStatusCode.BadGateway) { RequestMessage = request, ReasonPhrase = exception.Message.ReplaceLineEndings(" ") };
        }
    }
}
