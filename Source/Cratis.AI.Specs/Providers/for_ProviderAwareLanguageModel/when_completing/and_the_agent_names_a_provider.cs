// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_the_agent_names_a_provider : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test"));
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_answer_from_the_named_provider() => _result.Text.ShouldEqual("from-anthropic");
    [Fact] void should_stamp_the_provider_on_the_result() => _result.ProviderId.ShouldEqual(_provider);

    [Fact]
    void should_use_the_tier_resolved_on_the_provider() =>
        _anthropicClient.Received(1).Complete("prompt", Arg.Any<ConfiguredAIProvider>(), "claude-sonnet-4-5", Arg.Any<Effort>(), Arg.Any<CancellationToken>());
}
