// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents.for_AgentCapabilityRequirements.when_resolving_requirements;

public class and_the_agent_uses_chat : Specification
{
    readonly AgentCapabilityRequirements _requirements = new(new DefaultAgentInvocationModes());
    IReadOnlySet<Providers.AIProviderCapability> _result;

    void Because() => _result = _requirements.For(AgentPurposes.IssueTriage);

    [Fact] void should_require_conversational_capability() => _result.ShouldContain(Providers.AIProviderCapability.Conversational);
    [Fact] void should_not_require_agentic_capability() => _result.ShouldNotContain(Providers.AIProviderCapability.Agentic);
}
