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
/// A member whose quota is spent is parked until the reset its vendor stated, and the same prompt is
/// sent to the next member in the same call (Cratis/AI#423).
/// </summary>
public class and_a_pool_member_is_out_of_quota : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();
    static readonly DateTimeOffset _reset = new(DateTimeOffset.UtcNow.AddDays(10).UtcDateTime.Date, TimeSpan.Zero);

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_first), new(_second)]));
        ProviderIs(_first, new(_first, AIProviderType.Anthropic, "sk-ant-test"));
        ProviderIs(_second, new(_second, AIProviderType.OpenAI, "sk-openai-test"));

        _anthropicClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.QuotaExhausted($"Anthropic model claude-sonnet-4 returned 429 rate_limit_error (enforced_spend_limit_reached); quota exhausted; resets at {_reset.UtcDateTime:yyyy-MM-ddTHH:mm:ss}Z"));
    }

    async Task Because() => _result = await _model.Complete("the whole prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_succeed_from_the_next_member() => _result.Text.ShouldEqual("from-openai");

    [Fact]
    void should_send_the_next_member_the_same_prompt() =>
        _openAIClient.Received(1).Complete("the whole prompt", Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>());

    [Fact]
    async Task should_park_the_provider_until_its_stated_reset() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordProviderRateLimited>(command => command.Provider == _first && command.Until == _reset));

    [Fact] void should_remember_the_failure_against_the_provider() => _recentProviderFailures.Received(1).Record(_first);
}
