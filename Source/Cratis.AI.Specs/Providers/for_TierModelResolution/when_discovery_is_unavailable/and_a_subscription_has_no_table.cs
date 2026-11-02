// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.for_TierModelResolution.when_discovery_is_unavailable;

/// <summary>
/// The normal state of a Claude subscription without a usage key, before and after discovery became typed.
/// </summary>
public class and_a_subscription_has_no_table : Specification
{
    ConfiguredAIProvider _provider;

    void Establish() => _provider = new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat01-fixture")
    {
        ModelDiscoveryStatus = AIModelDiscoveryStatus.Unavailable,
        ModelDiscoveryFailure = "fixture limitation"
    };

    [Theory]
    [InlineData(ModelTier.Fast, "haiku")]
    [InlineData(ModelTier.Balanced, "sonnet")]
    [InlineData(ModelTier.Powerful, "opus")]
    [InlineData(ModelTier.Premier, "opus")]
    public void should_resolve_the_subscription_alias(ModelTier tier, string alias)
    {
        var result = TierModelResolution.Explain(_provider, tier);
        result.Model.ShouldEqual(new ModelName(alias));
        result.Source.ShouldEqual(TierModelSource.SubscriptionAlias);
    }
}
