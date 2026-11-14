// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing_with_images;

/// <summary>
/// A pool member that cannot take images is skipped - without being recorded as a failure - and the
/// next member that can serves the completion.
/// </summary>
public class and_a_pool_member_lacks_vision_and_the_next_has_it : given.image_clients
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _blind = AIProviderId.New();
    static readonly AIProviderId _sighted = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_blind), new(_sighted)]));
        ProviderIs(_blind, ProviderWithModel(_blind, "llama-3-70b"));
        ProviderIs(_sighted, ProviderWithModel(_sighted, "gpt-4o", AIProviderType.OpenAI));

        // The sighted member is burnt hardest, so the blind one is tried first.
        RecordBurn(_sighted, 1_000_000);
    }

    async Task Because() => _result = await _model.Complete("prompt", Images, (LanguageModelPurpose)Purpose);

    [Fact] void should_serve_from_the_member_with_vision() => _result.Text.ShouldEqual("from-openai-images");
    [Fact] void should_stamp_the_serving_provider() => _result.ProviderId.ShouldEqual(_sighted);
    [Fact] void should_not_call_the_member_without_vision() => _anthropicImageClient.ReceivedCalls().Where(call => call.GetMethodInfo().Name == nameof(IAIProviderClient.Complete)).ShouldBeEmpty();
    [Fact] void should_not_record_the_refusal_as_a_failure() => _recentProviderFailures.DidNotReceive().Record(_blind);
}
