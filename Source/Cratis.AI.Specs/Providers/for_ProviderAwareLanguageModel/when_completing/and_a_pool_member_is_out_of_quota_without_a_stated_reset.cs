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
/// A spent quota whose vendor says nothing about when it resets still parks the provider - for the
/// bounded rate-limit cooldown - rather than letting the next call rediscover it.
/// </summary>
public class and_a_pool_member_is_out_of_quota_without_a_stated_reset : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();

    DateTimeOffset _started;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_first), new(_second)]));
        ProviderIs(_first, new(_first, AIProviderType.Anthropic, "sk-ant-test"));
        ProviderIs(_second, new(_second, AIProviderType.OpenAI, "sk-openai-test"));

        _anthropicClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.QuotaExhausted("Anthropic model claude-sonnet-4 returned 400 invalid_request_error; quota exhausted; vendor body: Your credit balance is too low"));
        _started = DateTimeOffset.UtcNow;
    }

    async Task Because() => await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact]
    async Task should_park_the_provider_for_at_least_the_cooldown() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordProviderRateLimited>(command =>
            command.Provider == _first && command.Until >= _started + new AIProviderOptions().RateLimitCooldown));
}
