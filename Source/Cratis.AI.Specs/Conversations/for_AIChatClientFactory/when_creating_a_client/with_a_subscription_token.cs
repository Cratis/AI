// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Anthropic;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_creating_a_client;

public class with_a_subscription_token : Specification
{
    (IChatClient Client, string ModelId)? _result;

    void Because() => _result = AIChatClientFactory.Create(AIProviderType.Anthropic, " sk-ant-oat-test\n", null, "sonnet");
    void Destroy() => _result?.Client.Dispose();

    [Fact] void should_build_a_client() => _result.ShouldNotBeNull();
    [Fact] void should_use_the_claude_code_cli_transport() => _result!.Value.Client.ShouldBeOfExactType<ClaudeCodeChatClient>();
    [Fact] void should_preserve_the_requested_model() => _result!.Value.ModelId.ShouldEqual("sonnet");
}
