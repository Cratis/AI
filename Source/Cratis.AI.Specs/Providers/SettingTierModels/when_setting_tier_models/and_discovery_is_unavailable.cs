// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.SettingTierModels.when_setting_tier_models;

public class and_discovery_is_unavailable : Specification
{
    readonly AIProviderId _provider = AIProviderId.New();
    readonly TierModels _models = TierModels.NotSet with { Fast = "chosen-fast" };
    object[] _events;
    TierModelResolved _resolution;

    void Because()
    {
        _events = new SetAIProviderTierModels(_provider, _models).Handle().ToArray();
        var provenance = _events.OfType<AIProviderTierModelsProvenanceSet>().Single();
        var provider = new ConfiguredAIProvider(_provider, AIProviderType.Anthropic, "sk-ant-oat01-fixture")
        {
            TierModels = provenance.Models,
            TierModelMappingSource = provenance.Source,
            ModelDiscoveryStatus = AIModelDiscoveryStatus.Unavailable
        };
        _resolution = TierModelResolution.Explain(provider, ModelTier.Fast);
    }

    [Fact] void should_emit_the_compatibility_mapping_first() => _events[0].ShouldEqual(new AIProviderTierModelsSet(_models));
    [Fact] void should_record_explicit_provenance_second() => _events[1].ShouldEqual(new AIProviderTierModelsProvenanceSet(_models, TierModelMappingSource.Explicit));
    [Fact] void should_record_both_events_in_one_batch() => _events.Length.ShouldEqual(2);
    [Fact] void should_resolve_the_explicit_selection() => _resolution.Model.ShouldEqual(_models.Fast);
    [Fact] void should_identify_the_model_as_configured() => _resolution.Source.ShouldEqual(TierModelSource.Configured);
}
