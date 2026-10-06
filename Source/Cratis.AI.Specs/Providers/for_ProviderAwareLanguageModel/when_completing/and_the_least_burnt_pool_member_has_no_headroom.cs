// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Capacity;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// A subscription whose weekly window is spent is skipped without a call, however little it has
/// burnt - the pool moves straight to a member that still has headroom.
/// </summary>
public class and_the_least_burnt_pool_member_has_no_headroom : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _spent = AIProviderId.New();
    static readonly AIProviderId _available = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_spent), new(_available)]));
        ProviderIs(_spent, new(_spent, AIProviderType.Anthropic, "sk-ant-oat-test"));
        ProviderIs(_available, new(_available, AIProviderType.OpenAI, "sk-openai-test"));
        RecordBurn(_available, 50_000);
        CapacityIs(_spent, [new(UsageWindowKind.Weekly, "Weekly", 1, DateTimeOffset.UtcNow.AddDays(2))]);
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_complete_on_the_member_with_headroom() => _result.Text.ShouldEqual("from-openai");
    [Fact] void should_not_call_the_spent_member() => _anthropicClient.DidNotReceive().Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>());
}
