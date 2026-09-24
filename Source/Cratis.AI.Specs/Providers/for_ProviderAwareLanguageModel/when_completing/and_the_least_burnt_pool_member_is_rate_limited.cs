// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// A member already marked rate-limited (whether recorded by a worker's own failure text or by this
/// same completion path on an earlier call) is skipped without spending a real call on it, exactly as
/// <c>ActingAgentResolver.Resolve</c> already skips it for work dispatch
/// (issue #1060).
/// </summary>
public class and_the_least_burnt_pool_member_is_rate_limited : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _limited = AIProviderId.New();
    static readonly AIProviderId _fresh = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));

        // Declaration order is the pool's tie-break when burn is equal, so the rate-limited member
        // would be picked first were it not skipped.
        PoolIs(_pool, new(_pool, "Main pool", [new(_limited), new(_fresh)]));
        ProviderIs(_limited, new(_limited, AIProviderType.Anthropic, "sk-ant-test") { RateLimitedUntil = DateTimeOffset.UtcNow.AddHours(1) });
        ProviderIs(_fresh, new(_fresh, AIProviderType.OpenAI, "sk-openai-test"));
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_answer_from_the_member_that_is_not_rate_limited() => _result.Text.ShouldEqual("from-openai");
    [Fact] void should_stamp_that_member_on_the_result() => _result.ProviderId.ShouldEqual(_fresh);

    [Fact]
    void should_never_touch_the_rate_limited_member() =>
        _anthropicClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, default);
}
