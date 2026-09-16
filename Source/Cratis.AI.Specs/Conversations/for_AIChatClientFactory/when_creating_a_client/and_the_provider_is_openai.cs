// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_creating_a_client;

public class and_the_provider_is_openai : Specification
{
    (Microsoft.Extensions.AI.IChatClient Client, string ModelId)? _result;

    void Because() => _result = AIChatClientFactory.Create(AIProviderType.OpenAI, new AIProviderApiKey("sk-key"), null, "gpt-4o-mini");

    [Fact] void should_build_a_client() => _result.ShouldNotBeNull();
    [Fact] void should_carry_the_model_id() => _result!.Value.ModelId.ShouldEqual("gpt-4o-mini");
}
