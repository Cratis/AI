// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Cratis.AI.Providers.ZAI.for_ZAIProviderClient.when_completing.given;

/// <summary>
/// Captures the request a <see cref="ZAIProviderClient"/> actually sent, without a real network
/// call - a fake <see cref="HttpMessageHandler"/> the client's <see cref="IHttpClientFactory"/>
/// hands out, answering a minimal successful Messages API response.
/// </summary>
public class a_stub_message_server : Specification
{
    protected CapturingHandler Handler;
    protected ZAIProviderClient Client;

    void Establish()
    {
        Handler = new CapturingHandler();
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient(Handler));
        Client = new ZAIProviderClient(factory, Substitute.For<IAIProviderQuotaTracker>(), Substitute.For<ILogger<ZAIProviderClient>>());
    }

    public sealed class CapturingHandler : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"content":[{"type":"text","text":"ok"}]}"""),
            };
            return Task.FromResult(response);
        }
    }
}
