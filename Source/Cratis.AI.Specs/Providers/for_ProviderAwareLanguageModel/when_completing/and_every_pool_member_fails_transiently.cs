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
/// A pool exhausted purely by transient failures fails with a RESULT, never an exception (issue
/// #882), and is itself marked transient so ManagedLanguageModel's whole-call retry gets another shot
/// at the pool rather than treating this the same as a genuine misconfiguration (issue #1060).
/// </summary>
public class and_every_pool_member_fails_transiently : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_first), new(_second)]));
        ProviderIs(_first, new(_first, AIProviderType.Anthropic, "sk-ant-test"));
        ProviderIs(_second, new(_second, AIProviderType.OpenAI, "sk-openai-test"));

        _anthropicClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.TransientFailure("The language model API returned 503"));
        _openAIClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.TransientFailure("The language model API returned 503"));
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_be_a_result_rather_than_throwing() => _result.ShouldNotBeNull();
    [Fact] void should_be_marked_transient_so_the_whole_call_can_be_retried() => _result.IsTransient.ShouldBeTrue();

    [Fact]
    void should_have_tried_both_members() =>
        _anthropicClient.Received(1).Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>());
}
