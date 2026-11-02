// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.for_TierModelResolution.when_discovery_is_unavailable;

/// <summary>
/// Before discovery was typed, a provider that cannot list its models recorded a failed discovery. Without a
/// recorded derivation, an unavailable discovery must resolve every tier exactly as that failure did.
/// </summary>
public class and_no_derivation_is_recorded : Specification
{
    static readonly DateTimeOffset _at = DateTimeOffset.Parse("2026-09-20T10:00:00Z");

    static readonly Dictionary<string, ConfiguredAIProvider> _providers = new()
    {
        ["subscription without a table"] = Subscription(),
        ["subscription with a partial table"] = Subscription() with { TierModels = TierModels.NotSet with { Fast = "chosen-fast" } },
        ["subscription with a historical catalog and derived-looking table"] = Subscription() with
            {
                TierModels = TierModels.NotSet with { Fast = "claude-haiku-4-5" },
                AvailableModels = [new("claude-haiku-4-5")],
                ModelsDiscoveredAt = _at
            },
        ["subscription whose table contradicts the historical catalog"] = Subscription() with
            {
                TierModels = TierModels.NotSet with { Fast = "chosen-fast" },
                AvailableModels = [new("claude-haiku-4-5")],
                ModelsDiscoveredAt = _at
            },
        ["api key without a table"] = new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-api03-fixture")
    };

    public static TheoryData<string> Fixtures() => [.. _providers.Keys];

    [Theory]
    [MemberData(nameof(Fixtures))]
    public void should_resolve_every_tier_as_a_failed_discovery_does(string fixture)
    {
        var provider = _providers[fixture];
        foreach (var tier in Enum.GetValues<ModelTier>())
        {
            var unavailable = TierModelResolution.Explain(provider with { ModelDiscoveryStatus = AIModelDiscoveryStatus.Unavailable }, tier);
            var failed = TierModelResolution.Explain(provider with { ModelDiscoveryStatus = AIModelDiscoveryStatus.Failed }, tier);
            (fixture, unavailable).ShouldEqual((fixture, failed));
        }
    }

    static ConfiguredAIProvider Subscription() => new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat01-fixture");
}
