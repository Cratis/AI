// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_mapping_names_a_model_the_catalog_lacks;

public class and_the_catalog_was_discovered : Specification
{
    ConfiguredAIProvider _provider;
    TierModelResolved _resolution;

    void Establish() => _provider = new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-test")
    {
        TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
        AvailableModels = [new("claude-sonnet-4-5")],
        ModelsDiscoveredAt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero)
    };

    void Because() => _resolution = TierModelResolution.Explain(_provider, ModelTier.Balanced);

    [Fact] void should_refuse_the_missing_model() => _resolution.Model.ShouldEqual(ModelName.NotSet);
    [Fact] void should_report_the_unsatisfied_source() => _resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_name_the_tier() => _resolution.Reason.ShouldContain("Balanced");
    [Fact] void should_name_the_model() => _resolution.Reason.ShouldContain("retired-sonnet");
    [Fact] void should_name_the_provider() => _resolution.Reason.ShouldContain(_provider.Id.Value.ToString());
    [Fact] void should_name_the_discovery_time() => _resolution.Reason.ShouldContain(_provider.ModelsDiscoveredAt.ToString("O"));
    [Fact] void should_refuse_through_the_provider_overload() => TierModelResolution.Resolve(_provider, ModelTier.Balanced).ShouldEqual(ModelName.NotSet);
    [Fact] void should_refuse_through_the_mapping_overload() => TierModelResolution.Resolve(_provider.TierModels, _provider.AvailableModels, ModelTier.Balanced).ShouldEqual(ModelName.NotSet);
}
