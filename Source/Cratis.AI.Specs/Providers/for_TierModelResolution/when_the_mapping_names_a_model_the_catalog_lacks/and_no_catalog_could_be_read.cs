// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_mapping_names_a_model_the_catalog_lacks;

public class and_no_catalog_could_be_read : Specification
{
    TierModelResolved _resolution;

    void Because() => _resolution = TierModelResolution.Explain(
        new(AIProviderId.New(), AIProviderType.OpenAICodex, "test-token")
        {
            TierModels = new(ModelName.NotSet, "hand-named-model", ModelName.NotSet, ModelName.NotSet),
            ModelDiscoveryFailure = "This provider publishes no catalog."
        },
        ModelTier.Balanced);

    [Fact] void should_trust_the_explicit_mapping() => _resolution.Model.ShouldEqual((ModelName)"hand-named-model");
    [Fact] void should_report_a_configured_source() => _resolution.Source.ShouldEqual(TierModelSource.Configured);
    [Fact] void should_not_report_a_refusal() => _resolution.Reason.ShouldBeEmpty();
}
