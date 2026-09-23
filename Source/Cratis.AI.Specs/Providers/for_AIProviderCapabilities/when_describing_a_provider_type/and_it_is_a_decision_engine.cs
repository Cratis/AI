// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_AIProviderCapabilities.when_describing_a_provider_type;

/// <summary>
/// A decision engine weighs choices and nothing else. Declaring the capabilities it lacks is what
/// stops an agent ever being scheduled onto it - the compatibility checks that already exist read
/// this, so the refusal needs no new code anywhere else.
/// </summary>
public class and_it_is_a_decision_engine : Specification
{
    IReadOnlySet<AIProviderCapability> _result;

    void Because() => _result = AIProviderCapabilities.For(AIProviderType.DecisionEngine);

    [Fact] void should_support_decisions() => _result.ShouldContain(AIProviderCapability.Decision);
    [Fact] void should_not_be_conversational() => _result.ShouldNotContain(AIProviderCapability.Conversational);
    [Fact] void should_not_be_agentic() => _result.ShouldNotContain(AIProviderCapability.Agentic);
}
