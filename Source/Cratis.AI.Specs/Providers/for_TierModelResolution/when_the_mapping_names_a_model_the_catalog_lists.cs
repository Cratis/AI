// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution;

public class when_the_mapping_names_a_model_the_catalog_lists : Specification
{
    TierModelResolved _resolution;

    void Because() => _resolution = TierModelResolution.Explain(
        new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-test")
        {
            TierModels = new(ModelName.NotSet, "claude-haiku-4-5", ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new("claude-haiku-4-5"), new("claude-sonnet-4-5")]
        },
        ModelTier.Balanced);

    [Fact] void should_keep_the_deliberately_mapped_model() => _resolution.Model.ShouldEqual((ModelName)"claude-haiku-4-5");
    [Fact] void should_report_a_configured_source() => _resolution.Source.ShouldEqual(TierModelSource.Configured);
    [Fact] void should_not_report_a_borrowed_rung() => _resolution.Reason.ShouldBeEmpty();
}
