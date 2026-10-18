// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Listing.for_AgentTierPreview.when_previewing_a_tier;

public class with_an_unknown_agent : given.an_agent
{
    void Establish() => _readModels.GetInstanceById<Agent>((EventSourceId)_agentId).Returns((Agent)null!);

    async Task Because() => _rows = (await AgentTierPreview.PreviewAgentTier(_agentId, ModelTier.Powerful, _readModels)).ToArray();

    [Fact] void should_return_an_explicit_refusal() => _rows.Single().Resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_explain_the_missing_agent() => _rows.Single().Resolution.Reason.ShouldContain($"Agent {_agentId} could not be found");
    [Fact] void should_not_name_a_model() => _rows.Single().Resolution.Model.ShouldEqual(ModelName.NotSet);
}
