// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_checking_readiness;

public class and_openai_has_a_key : Specification
{
    bool _result;

    void Because() => _result = AIChatClientFactory.CanServe(AIProviderType.OpenAI, new AIProviderApiKey("sk-key"), null, null);

    [Fact] void should_be_able_to_serve() => _result.ShouldBeTrue();
}
