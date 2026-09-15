// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Cratis.AI.Providers.OpenAI.for_OpenAIProviderClient.when_completing;

/// <summary>
/// A ChatGPT subscription authenticates against the ChatGPT backend a Codex-style harness provider
/// talks to, not against api.openai.com. Sending it there is an unexplained 401 - this client
/// refuses before ever sending the request, and says why.
/// </summary>
public class and_the_provider_has_a_subscription_credential : Specification
{
    OpenAIProviderClient _client;
    ConfiguredAIProvider _provider;
    LanguageModelResult _result;

    void Establish()
    {
        _client = new OpenAIProviderClient(Substitute.For<IHttpClientFactory>(), Substitute.For<ILogger<OpenAIProviderClient>>());
        _provider = new ConfiguredAIProvider(
            AIProviderId.New(),
            AIProviderType.OpenAI,
            new AIProviderApiKey("""{"type":"oauth","access":"tok","refresh":"rt","expires":4102444800000}"""));
    }

    async Task Because() => _result = await _client.Complete("prompt", _provider, new ModelName("gpt-4o"), Effort.Medium);

    [Fact] void should_not_have_succeeded() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_say_why() => _result.FailureReason.ShouldContain("ChatGPT subscription");
}
