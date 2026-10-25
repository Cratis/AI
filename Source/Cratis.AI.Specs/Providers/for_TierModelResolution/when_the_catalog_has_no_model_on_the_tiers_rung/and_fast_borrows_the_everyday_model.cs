// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_catalog_has_no_model_on_the_tiers_rung;

public class and_fast_borrows_the_everyday_model : Specification
{
    TierModelResolved _resolution;

    void Because() => _resolution = TierModelResolution.Explain(
        new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-test")
        {
            AvailableModels = [new("claude-sonnet-4-5"), new("claude-opus-4-5")]
        },
        ModelTier.Fast);

    [Fact] void should_preserve_the_borrowing_order() => _resolution.Model.ShouldEqual((ModelName)"claude-sonnet-4-5");
    [Fact] void should_report_a_borrowed_source() => _resolution.Source.ShouldEqual(TierModelSource.Borrowed);
    [Fact] void should_explain_the_borrowed_rung() => _resolution.Reason.ShouldContain("Everyday");
    [Fact] void should_explain_the_missing_rung() => _resolution.Reason.ShouldContain("Modest");
}
