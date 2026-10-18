// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Agents.Listing.for_AgentTierPreview.given;

public class an_agent : Specification
{
    protected readonly AgentId _agentId = AgentId.For("preview");
    protected readonly AIProviderId _providerId = AIProviderId.New();
    protected readonly AIProviderPoolId _poolId = AIProviderPoolId.New();
    protected IReadModels _readModels;
    protected Agent _agent;
    protected AgentTierPreview[] _rows;

    void Establish()
    {
        _readModels = Substitute.For<IReadModels>();
        _agent = new(_agentId, "preview", "Preview", "An agent for tier previews", ModelTier.Fast, _providerId, null);
        _readModels.GetInstanceById<Agent>((EventSourceId)_agentId).Returns(_agent);
    }
}
