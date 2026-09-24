// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text;
using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.ZAI.for_ZAIProviderClient.given;

public class a_client_with_a_stubbed_endpoint : Specification
{
    protected ZAIProviderClient _client;
    protected ConfiguredAIProvider _provider;
    protected HttpStatusCode _statusCode;
    protected string _body;
    protected HttpRequestMessage _request;
    protected string _requestBody;

    void Establish()
    {
        _statusCode = HttpStatusCode.OK;
        _body = """{"content":[{"type":"text","text":"Hello!"}],"usage":{"input_tokens":12,"output_tokens":3}}""";
        _provider = new ConfiguredAIProvider(
            AIProviderId.New(),
            AIProviderType.ZAI,
            new AIProviderApiKey("a-zai-key"))
        {
            Endpoint = new AIProviderEndpoint("https://z.example/api/anthropic"),
        };

        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient(new StubHandler(this)));
        _client = new(factory, Substitute.For<IAIProviderQuotaTracker>(), Substitute.For<ILogger<ZAIProviderClient>>());
    }

    protected async Task<LanguageModelResult> PerformCompletion() =>
        await _client.Complete("a prompt", _provider, new ModelName("glm-5.2"), Effort.Medium);

    sealed class StubHandler(a_client_with_a_stubbed_endpoint context) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            context._request = request;

            // Read while the request is still alive - the client disposes it before the assertions run.
            context._requestBody = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(context._statusCode)
            {
                Content = new StringContent(context._body, Encoding.UTF8, "application/json")
            };
        }
    }
}
