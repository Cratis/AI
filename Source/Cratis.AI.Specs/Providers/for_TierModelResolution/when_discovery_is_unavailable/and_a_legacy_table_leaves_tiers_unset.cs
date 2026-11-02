// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.for_TierModelResolution.when_discovery_is_unavailable;

public class and_a_legacy_table_leaves_tiers_unset : Specification
{
    ConfiguredAIProvider _provider;

    void Establish() => _provider = new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat01-fixture")
    {
        TierModels = TierModels.NotSet with { Fast = "chosen-fast" },
        TierModelMappingSource = TierModelMappingSource.Unknown,
        ModelDiscoveryStatus = AIModelDiscoveryStatus.Unavailable
    };

    [Fact]
    void should_resolve_the_mapped_tier() =>
        TierModelResolution.Explain(_provider, ModelTier.Fast).ShouldEqual(new TierModelResolved(ModelTier.Fast, "chosen-fast", TierModelSource.Configured, string.Empty));

    [Fact]
    void should_resolve_an_unset_tier_through_the_subscription_alias() =>
        TierModelResolution.Explain(_provider, ModelTier.Balanced).ShouldEqual(new TierModelResolved(ModelTier.Balanced, "sonnet", TierModelSource.SubscriptionAlias, string.Empty));
}
