// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_mapping_names_a_model_the_catalog_lacks;

public class and_the_successful_catalog_is_empty : Specification
{
    TierModelResolved _resolution;

    void Because() => _resolution = TierModelResolution.Explain(
        new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat-test")
        {
            TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
            ModelsDiscoveredAt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero)
        },
        ModelTier.Balanced);

    [Fact] void should_refuse_the_configured_model() => _resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_not_substitute_a_subscription_alias() => _resolution.Model.ShouldEqual(ModelName.NotSet);
    [Fact] void should_explain_the_missing_model() => _resolution.Reason.ShouldContain("retired-sonnet");
}
