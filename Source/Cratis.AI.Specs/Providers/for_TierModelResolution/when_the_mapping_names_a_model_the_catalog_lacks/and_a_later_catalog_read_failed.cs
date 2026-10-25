// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_mapping_names_a_model_the_catalog_lacks;

public class and_a_later_catalog_read_failed : Specification
{
    TierModelResolved _resolution;

    void Because() => _resolution = TierModelResolution.Explain(
        new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat-test")
        {
            TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new("claude-sonnet-4-5")],
            ModelDiscoveryFailure = "The latest refresh failed."
        },
        ModelTier.Balanced);

    [Fact] void should_still_refuse_against_the_last_successful_catalog() => _resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_not_substitute_a_subscription_alias() => _resolution.Model.ShouldEqual(ModelName.NotSet);
}
