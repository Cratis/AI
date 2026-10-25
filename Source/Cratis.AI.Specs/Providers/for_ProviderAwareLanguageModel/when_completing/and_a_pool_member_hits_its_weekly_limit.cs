// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;
using Cratis.AI.Providers.RateLimiting;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// A weekly limit that states when it resets parks the provider until then - not for the flat
/// cooldown, after which it would be tried, and turned away, every hour for days - and the pool
/// fails over in the same call.
/// </summary>
public class and_a_pool_member_hits_its_weekly_limit : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();
    static readonly DateTimeOffset _reset = DateTimeOffset.UtcNow.AddDays(3);

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_first), new(_second)]));
        ProviderIs(_first, new(_first, AIProviderType.Anthropic, "sk-ant-test"));
        ProviderIs(_second, new(_second, AIProviderType.OpenAI, "sk-openai-test"));

        _anthropicClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.TransientFailure($"You've hit your weekly limit · resets at {_reset.UtcDateTime:yyyy-MM-ddTHH:mm:ss}Z"));
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_succeed_from_the_next_member() => _result.Text.ShouldEqual("from-openai");

    [Fact]
    async Task should_park_the_provider_until_the_stated_reset() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordProviderRateLimited>(command => command.Provider == _first && command.Until == new DateTimeOffset(_reset.UtcDateTime.Year, _reset.UtcDateTime.Month, _reset.UtcDateTime.Day, _reset.UtcDateTime.Hour, _reset.UtcDateTime.Minute, _reset.UtcDateTime.Second, TimeSpan.Zero)));

    [Fact] void should_forget_the_providers_cached_capacity() => _providerCapacities.Received(1).Forget(_first);
}
