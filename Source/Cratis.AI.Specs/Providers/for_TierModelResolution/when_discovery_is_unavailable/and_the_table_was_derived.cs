// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.for_TierModelResolution.when_discovery_is_unavailable;

public class and_the_table_was_derived : Specification
{
    ConfiguredAIProvider _provider;

    void Establish() => _provider = new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat01-fixture")
    {
        TierModels = TierModels.NotSet with { Fast = "claude-haiku-4-5" },
        TierModelMappingSource = TierModelMappingSource.Derived,
        AvailableModels = [new("claude-haiku-4-5")],
        ModelsDiscoveredAt = DateTimeOffset.Parse("2026-09-20T10:00:00Z"),
        ModelDiscoveryStatus = AIModelDiscoveryStatus.Unavailable
    };

    [Fact]
    void should_refuse_the_derived_tier()
    {
        var result = TierModelResolution.Explain(_provider, ModelTier.Fast);
        result.Model.ShouldEqual(ModelName.NotSet);
        result.Source.ShouldEqual(TierModelSource.Unsatisfied);
        result.Reason.ShouldContain("review and save");
    }

    [Fact]
    void should_not_fall_back_to_a_subscription_alias_for_an_unset_tier() =>
        TierModelResolution.Explain(_provider, ModelTier.Balanced).Source.ShouldEqual(TierModelSource.Unsatisfied);

    [Fact]
    void should_resolve_the_table_once_the_operator_saves_it() =>
        TierModelResolution.Resolve(_provider with { TierModelMappingSource = TierModelMappingSource.Unknown }, ModelTier.Fast)
            .ShouldEqual(new ModelName("claude-haiku-4-5"));

    [Fact]
    void should_not_change_a_failed_discovery() =>
        TierModelResolution.Resolve(_provider with { ModelDiscoveryStatus = AIModelDiscoveryStatus.Failed }, ModelTier.Fast)
            .ShouldEqual(new ModelName("claude-haiku-4-5"));

    [Fact]
    void should_not_change_a_successful_discovery() =>
        TierModelResolution.Resolve(_provider with { ModelDiscoveryStatus = AIModelDiscoveryStatus.Discovered }, ModelTier.Fast)
            .ShouldEqual(new ModelName("claude-haiku-4-5"));
}
