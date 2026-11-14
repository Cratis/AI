// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.Anthropic.for_AnthropicProviderClient.when_completing_with_images;

/// <summary>
/// A Claude subscription token can only travel through the Claude Code transport, which takes no
/// images - so the completion is refused rather than sent without them.
/// </summary>
public class and_the_credential_is_a_subscription_token : Specification
{
    IHttpClientFactory _http = null!;
    IClaudeCodeCompletion _claude = null!;
    LanguageModelResult _result = null!;

    void Establish()
    {
        _http = Substitute.For<IHttpClientFactory>();
        _claude = Substitute.For<IClaudeCodeCompletion>();
    }

    async Task Because() => _result = await new AnthropicProviderClient(_http, Substitute.For<IAIProviderQuotaTracker>(), _claude, Substitute.For<ILogger<AnthropicProviderClient>>())
        .Complete(new(
            "Analyze this",
            [new(new byte[] { 1, 2, 3 }, "image/png")],
            new ConfiguredAIProvider(Guid.NewGuid(), AIProviderType.Anthropic, " sk-ant-oat-test "),
            "claude-sonnet-4-6",
            Effort.High));

    [Fact] void should_refuse_the_completion() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_say_an_api_key_is_needed() => _result.FailureReason.ShouldContain("API key");
    [Fact] void should_not_use_the_claude_code_transport() => _claude.ReceivedCalls().ShouldBeEmpty();
    [Fact] void should_not_send_a_raw_messages_request() => _http.DidNotReceiveWithAnyArgs().CreateClient(default!);
}
