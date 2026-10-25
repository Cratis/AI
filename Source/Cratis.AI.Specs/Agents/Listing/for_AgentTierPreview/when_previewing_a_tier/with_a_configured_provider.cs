// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Listing.for_AgentTierPreview.when_previewing_a_tier;

public class with_a_configured_provider : given.an_agent
{
    void Establish() => _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId).Returns(new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, "sk-ant-test")
    {
        TierModels = new(ModelName.NotSet, "claude-sonnet-4-5", ModelName.NotSet, ModelName.NotSet)
    });

    async Task Because() => _rows = (await AgentTierPreview.PreviewAgentTier(_agentId, ModelTier.Balanced, _readModels)).ToArray();

    [Fact] void should_return_one_row() => _rows.Length.ShouldEqual(1);
    [Fact] void should_identify_the_agent() => _rows.Single().AgentId.ShouldEqual(_agentId);
    [Fact] void should_identify_the_provider() => _rows.Single().ProviderId.ShouldEqual(_providerId);
    [Fact] void should_use_the_proposed_tier() => _rows.Single().Resolution.Tier.ShouldEqual(ModelTier.Balanced);
    [Fact] void should_resolve_the_model() => _rows.Single().Resolution.Model.ShouldEqual((ModelName)"claude-sonnet-4-5");
    [Fact] void should_explain_its_source() => _rows.Single().Resolution.Source.ShouldEqual(TierModelSource.Configured);
    [Fact] void should_leave_the_agent_unchanged() => _agent.Tier.ShouldEqual(ModelTier.Fast);
}
