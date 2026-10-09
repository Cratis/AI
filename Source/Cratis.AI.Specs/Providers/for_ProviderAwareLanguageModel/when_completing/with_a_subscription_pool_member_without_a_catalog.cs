// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class with_a_subscription_pool_member_without_a_catalog : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Subscriptions", [new(_provider)]));

        // Do not use ProviderIs: that helper supplies a catalog, masking this regression.
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_provider)
            .Returns(new ConfiguredAIProvider(_provider, AIProviderType.Anthropic, "sk-ant-oat-test"));
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_use_the_subscription_member() => _result.ProviderId.ShouldEqual(_provider);
    [Fact] void should_complete_instead_of_skipping_an_empty_catalog() => _result.Succeeded.ShouldBeTrue();
    [Fact] void should_pass_the_official_cli_alias() => _anthropicClient.Received(1).Complete("prompt", Arg.Any<ConfiguredAIProvider>(), "sonnet", Arg.Any<Effort>(), Arg.Any<CancellationToken>());
}
