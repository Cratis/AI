// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_a_pool_contains_an_excluded_member : given.a_restricted_provider
{
    LanguageModelResult _result;

    void Establish()
    {
        var pool = AIProviderPoolId.New();
        var allowed = AIProviderId.New();
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Assistant", "Assists.", ModelTier.Balanced, null, pool));
        PoolIs(pool, new(pool, "Pool", [new(_provider), new(allowed)]));
        ProviderIs(allowed, new(allowed, AIProviderType.OpenAI, "test"));
    }

    async Task Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"bob"));
        _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);
    }

    [Fact] void should_use_the_allowed_member() => _result.Text.ShouldEqual("from-openai");
    [Fact] void should_not_call_the_excluded_member() => _anthropicClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, TestContext.Current.CancellationToken);
}
