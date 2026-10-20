// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution;

public class when_discovery_found_no_models : Specification
{
    readonly AIProviderId _providerId = AIProviderId.New();
    TierModelResolved _resolution;

    void Because() => _resolution = TierModelResolution.Explain(
        new(_providerId, AIProviderType.Anthropic, "sk-ant-test")
        {
            ModelsDiscoveredAt = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero)
        },
        ModelTier.Premier);

    [Fact] void should_resolve_to_no_model() => _resolution.Model.ShouldEqual(ModelName.NotSet);
    [Fact] void should_report_an_unsatisfied_source() => _resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_explain_the_discovery_outcome() => _resolution.Reason.ShouldEqual(
        $"AI provider {_providerId} (Anthropic) cannot satisfy Premier: model discovery at 2026-10-20T12:00:00.0000000+00:00 found 0 models and none can serve Premier. Map a model for Premier in the provider's tier settings.");
}
