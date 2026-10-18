// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Listing.for_AgentTierPreview.when_previewing_a_tier;

public class without_an_assignment : given.an_agent
{
    void Establish() => _readModels.GetInstanceById<Agent>((EventSourceId)_agentId).Returns(_agent with { ProviderId = AIProviderId.NotSet });

    async Task Because() => _rows = (await AgentTierPreview.PreviewAgentTier(_agentId, ModelTier.Balanced, _readModels)).ToArray();

    [Fact] void should_return_an_explicit_refusal() => _rows.Single().Resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_explain_the_missing_assignment() => _rows.Single().Resolution.Reason.ShouldContain("no AI provider or pool configured");
}
