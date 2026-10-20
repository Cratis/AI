// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution;

public class when_models_have_never_been_discovered : Specification
{
    readonly AIProviderId _providerId = AIProviderId.New();
    TierModelResolved _resolution;

    void Because() => _resolution = TierModelResolution.Explain(
        new(_providerId, AIProviderType.Anthropic, "sk-ant-test"),
        ModelTier.Premier);

    [Fact] void should_resolve_to_no_model() => _resolution.Model.ShouldEqual(ModelName.NotSet);
    [Fact] void should_report_an_unsatisfied_source() => _resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_explain_the_discovery_outcome() => _resolution.Reason.ShouldEqual(
        $"AI provider {_providerId} (Anthropic) cannot satisfy Premier: its models have never been discovered. Refresh the provider's models, and check its API key if that fails.");
}
