// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_creating_a_client;

public class with_an_anthropic_console_key : Specification
{
    (IChatClient Client, string ModelId)? _result;

    void Because() => _result = AIChatClientFactory.Create(AIProviderType.Anthropic, "sk-ant-api-test", null, "claude-sonnet-4-6");
    void Destroy() => _result?.Client.Dispose();

    [Fact] void should_keep_the_supported_api_transport() => _result.ShouldNotBeNull();
    [Fact] void should_preserve_the_requested_model() => _result!.Value.ModelId.ShouldEqual("claude-sonnet-4-6");
}
