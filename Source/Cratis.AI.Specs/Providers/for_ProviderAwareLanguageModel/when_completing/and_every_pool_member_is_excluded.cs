// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_every_pool_member_is_excluded : given.a_restricted_provider
{
    LanguageModelResult _result;

    void Establish()
    {
        var pool = AIProviderPoolId.New();
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Assistant", "Assists.", ModelTier.Balanced, null, pool));
        PoolIs(pool, new(pool, "Pool", [new(_provider)]));
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_fail_closed() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_retry() => _result.IsTransient.ShouldBeFalse();
    [Fact] void should_explain_access() => _result.FailureReason.ShouldContain("work initiator");
    [Fact] void should_not_call_the_vendor() => _anthropicClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, default);
    [Fact] void should_not_record_a_vendor_failure() => _recentProviderFailures.DidNotReceive().Record(_provider);
}
