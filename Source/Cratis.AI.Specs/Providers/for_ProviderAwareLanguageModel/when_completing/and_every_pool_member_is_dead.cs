// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_every_pool_member_is_dead : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_first), new(_second)]));
        ProviderIs(_first, null);
        ProviderIs(_second, null);
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();

    [Fact]
    void should_say_the_configured_provider_could_not_serve_it() =>
        _result.FailureReason.ShouldContain("could not serve");

    [Fact]
    void should_log_that_the_pool_was_exhausted() =>
        _logger.WarningsAndAbove.Any(message => message.Contains(_pool.Value.ToString())).ShouldBeTrue();
}
