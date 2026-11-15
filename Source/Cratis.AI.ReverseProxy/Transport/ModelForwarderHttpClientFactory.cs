// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;
using Yarp.ReverseProxy.Forwarder;

namespace Cratis.AI.ReverseProxy.Transport;

/// <summary>
/// Gives YARP the <see cref="ModelTransportHandler"/> in place of the socket handler it would build, which is how a custom
/// <see cref="IModelTransport"/> becomes the way the proxy reaches its backends.
/// </summary>
/// <param name="endpoints">The <see cref="IModelEndpoints"/>.</param>
/// <param name="transport">The <see cref="IModelTransport"/>.</param>
public sealed class ModelForwarderHttpClientFactory(IModelEndpoints endpoints, IModelTransport transport) : IForwarderHttpClientFactory, IDisposable
{
    readonly HttpMessageInvoker _invoker = new(new ModelTransportHandler(endpoints, transport), disposeHandler: false);

    /// <inheritdoc/>
    public void Dispose() => _invoker.Dispose();

    /// <inheritdoc/>
    public HttpMessageInvoker CreateClient(ForwarderHttpClientContext context) => _invoker;
}
