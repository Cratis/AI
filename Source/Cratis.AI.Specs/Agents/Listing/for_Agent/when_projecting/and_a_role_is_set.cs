// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Listing.for_AIRole.when_projecting;

public class and_a_role_is_set : Specification
{
    static readonly AgentId _id = AgentId.For("AutoMergeClassification");

    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(new AgentConfigured("AutoMergeClassification", "Gatekeeper", "Reads a diff and judges whether it is safe to merge.", ModelTier.Powerful, ProviderId: null, PoolId: null, Harness.Claude, Effort.High));

    [Fact] void should_hold_the_purpose() => _scenario.Instance.Purpose.ShouldEqual(new LanguageModelPurpose("AutoMergeClassification"));
    [Fact] void should_hold_the_name() => _scenario.Instance.Name.ShouldEqual(new AgentName("Gatekeeper"));
    [Fact] void should_hold_the_tier() => _scenario.Instance.Tier.ShouldEqual(ModelTier.Powerful);
}
