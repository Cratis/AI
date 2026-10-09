// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_checking_readiness;

public class with_a_subscription_token : Specification
{
    bool _ready;

    void Because() => _ready = AIChatClientFactory.CanServe(AIProviderType.Anthropic, " sk-ant-oat-test\n", null, null);

    [Fact] void should_claim_conversational_support() => _ready.ShouldBeTrue();
}
