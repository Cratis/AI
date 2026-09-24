// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.Anthropic.for_AnthropicProviderClient;

public class when_using_an_api_key : Specification
{
    MessagesResponse _response = null!;
    HttpClient _client = null!;
    IClaudeCodeCompletion _claude = null!;
    LanguageModelResult _result = null!;

    async Task Because()
    {
        _response = new();
        _client = new(_response);
        _claude = Substitute.For<IClaudeCodeCompletion>();
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient(Arg.Any<string>()).Returns(_client);
        _result = await new AnthropicProviderClient(factory, Substitute.For<IAIProviderQuotaTracker>(), _claude, Substitute.For<ILogger<AnthropicProviderClient>>())
            .Complete("Analyze", new ConfiguredAIProvider(Guid.NewGuid(), AIProviderType.Anthropic, "sk-ant-api-test"), "claude-sonnet-4-6", Effort.Low);
    }

    [Fact] void should_use_the_messages_api() => _result.Text.ShouldEqual("Analyzed");
    [Fact] void should_use_api_key_authentication() => _response.ApiKey.ShouldEqual("sk-ant-api-test");
    [Fact] async Task should_not_start_claude_code() => await _claude.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, default);

    void Destroy() => _client.Dispose();

    sealed class MessagesResponse : HttpMessageHandler
    {
        public string ApiKey { get; private set; } = string.Empty;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            ApiKey = request.Headers.GetValues("x-api-key").Single();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"content\":[{\"type\":\"text\",\"text\":\"Analyzed\"}]}")
            });
        }
    }
}
