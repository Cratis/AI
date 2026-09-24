// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_the_agent_names_no_provider_or_pool : given.all_dependencies
{
    LanguageModelResult _result;

    void Establish() =>
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, null));

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();

    [Fact]
    void should_say_no_provider_is_configured() =>
        _result.FailureReason.ShouldContain("has no AI provider or pool configured");

    [Fact]
    void should_never_touch_a_provider_client() =>
        _anthropicClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default);

    // This route used to be silent, which is what made an agent whose provider read back empty
    // indistinguishable from a deployment that had configured none (issue #103).
    [Fact]
    void should_say_why_it_fell_back() =>
        _logger.All.ShouldContain(message => message.Contains("names neither an AI provider nor a pool"));
}
