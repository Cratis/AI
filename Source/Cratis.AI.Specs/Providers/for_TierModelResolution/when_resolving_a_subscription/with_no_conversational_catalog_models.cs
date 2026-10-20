// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_resolving_a_subscription;

public class with_no_conversational_catalog_models : Specification
{
    Dictionary<ModelTier, TierModelResolved> _resolutions;

    void Because()
    {
        var provider = new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat-test")
        {
            AvailableModels = [(ModelName)"text-embedding-3-small"],
            ModelsDiscoveredAt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero)
        };
        _resolutions = Enum.GetValues<ModelTier>().ToDictionary(tier => tier, tier => TierModelResolution.Explain(provider, tier));
    }

    [Fact] void should_use_subscription_aliases() => _resolutions.Values.ShouldEachConformTo(resolution => resolution.Source == TierModelSource.SubscriptionAlias);
    [Fact] void should_use_haiku_for_fast() => _resolutions[ModelTier.Fast].Model.Value.ShouldEqual("haiku");
    [Fact] void should_use_sonnet_for_balanced() => _resolutions[ModelTier.Balanced].Model.Value.ShouldEqual("sonnet");
    [Fact] void should_use_opus_for_powerful() => _resolutions[ModelTier.Powerful].Model.Value.ShouldEqual("opus");
    [Fact] void should_use_opus_for_premier() => _resolutions[ModelTier.Premier].Model.Value.ShouldEqual("opus");
}
