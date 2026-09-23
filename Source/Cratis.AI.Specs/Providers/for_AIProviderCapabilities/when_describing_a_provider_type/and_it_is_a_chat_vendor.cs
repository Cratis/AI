// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_AIProviderCapabilities.when_describing_a_provider_type;

public class and_it_is_a_chat_vendor : Specification
{
    IReadOnlySet<AIProviderCapability> _result;

    void Because() => _result = AIProviderCapabilities.For(AIProviderType.Anthropic);

    [Fact] void should_be_conversational() => _result.ShouldContain(AIProviderCapability.Conversational);
    [Fact] void should_be_agentic() => _result.ShouldContain(AIProviderCapability.Agentic);
    [Fact] void should_not_claim_decision_making() => _result.ShouldNotContain(AIProviderCapability.Decision);
}
