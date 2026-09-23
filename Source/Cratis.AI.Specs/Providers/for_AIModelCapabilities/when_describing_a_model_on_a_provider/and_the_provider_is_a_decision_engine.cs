// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_AIModelCapabilities.when_describing_a_model_on_a_provider;

/// <summary>
/// The substring heuristic cannot see a decision model: a small open model's identifier carries no
/// marker distinguishing it from a chat model, and the existing markers would happily call it
/// conversational. On a decision engine the capability is declared by provider type instead.
/// </summary>
public class and_the_provider_is_a_decision_engine : Specification
{
    IReadOnlySet<AIModelCapability> _result;

    void Because() => _result = AIModelCapabilities.For(AIProviderType.DecisionEngine, (ModelName)"Qwen2.5-0.5B-Instruct");

    [Fact] void should_support_decisions() => _result.ShouldContain(AIModelCapability.Decision);
    [Fact] void should_not_claim_to_be_conversational() => _result.ShouldNotContain(AIModelCapability.Conversational);
    [Fact] void should_not_claim_tool_use() => _result.ShouldNotContain(AIModelCapability.ToolUse);
}
