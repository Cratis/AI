// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// A role naming an AI provider that does not resolve - removed, or a passive read model that has not
/// caught up with a very recent change - used to degrade into the exact same silent fallback as "no
/// provider was ever assigned", making a real misconfiguration indistinguishable from normal, unconfigured
/// behavior. This is the regression spec for that: the fallback still happens (resilience is unchanged),
/// but it must now be loud about why.
/// </summary>
public class and_the_named_provider_is_not_configured : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, null);
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();

    [Fact]
    void should_say_the_configured_provider_could_not_serve_it() =>
        _result.FailureReason.ShouldContain("could not serve");

    [Fact]
    void should_log_that_the_provider_did_not_resolve() =>
        _logger.WarningsAndAbove.Any(message => message.Contains(_provider.Value.ToString())).ShouldBeTrue();
}
