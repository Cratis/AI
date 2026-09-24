// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.Anthropic.for_AnthropicProviderClient;

public class when_using_a_subscription : Specification
{
    IHttpClientFactory _http = null!;
    IClaudeCodeCompletion _claude = null!;
    LanguageModelResult _result = null!;

    void Establish()
    {
        _http = Substitute.For<IHttpClientFactory>();
        _claude = Substitute.For<IClaudeCodeCompletion>();
        _claude.Complete("Analyze this", Arg.Any<AIProviderApiKey>(), Arg.Any<ModelName>(), Effort.High, CancellationToken.None)
            .Returns(LanguageModelResult.Success("Analyzed"));
    }

    async Task Because() => _result = await new AnthropicProviderClient(_http, Substitute.For<IAIProviderQuotaTracker>(), _claude, Substitute.For<ILogger<AnthropicProviderClient>>())
        .Complete("Analyze this", new ConfiguredAIProvider(Guid.NewGuid(), AIProviderType.Anthropic, " sk-ant-oat-test "), "claude-sonnet-4-6", Effort.High);

    [Fact] void should_receive_an_analysis() => _result.Text.ShouldEqual("Analyzed");
    [Fact] void should_not_send_a_raw_messages_request() => _http.DidNotReceiveWithAnyArgs().CreateClient(default!);
}
