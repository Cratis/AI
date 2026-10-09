// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_resolving_a_subscription;

public class without_a_catalog : Specification
{
    ConfiguredAIProvider _provider;
    Dictionary<ModelTier, ModelName> _models;

    void Establish() => _provider = new(AIProviderId.New(), AIProviderType.Anthropic, " sk-ant-oat-test\n");
    void Because() => _models = Enum.GetValues<ModelTier>().ToDictionary(tier => tier, tier => TierModelResolution.Resolve(_provider, tier));

    [Fact] void should_use_haiku_for_fast() => _models[ModelTier.Fast].Value.ShouldEqual("haiku");
    [Fact] void should_use_sonnet_for_balanced() => _models[ModelTier.Balanced].Value.ShouldEqual("sonnet");
    [Fact] void should_use_opus_for_powerful() => _models[ModelTier.Powerful].Value.ShouldEqual("opus");
    [Fact] void should_use_opus_for_premier() => _models[ModelTier.Premier].Value.ShouldEqual("opus");
    [Fact] void should_not_fabricate_a_discovered_catalog() => _provider.AvailableModels.ShouldBeEmpty();
}
