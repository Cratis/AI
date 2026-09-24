// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Providers.for_ProviderServing;

/// <summary>
/// Two states stop a provider answering, and only one of them was ever asked about. Both are
/// answered here, through the very resolution the completion path uses, so a sweep and a completion
/// can never disagree about whether there was any point in trying.
/// </summary>
public class when_asking_whether_a_provider_can_serve : Specification
{
    static readonly DateTimeOffset _now = new(2026, 9, 21, 15, 0, 0, TimeSpan.Zero);

    static ConfiguredAIProvider Provider(TierModels? tierModels = null, IEnumerable<ModelName>? available = null, DateTimeOffset? rateLimitedUntil = null) =>
        new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-test")
        {
            RateLimitedUntil = rateLimitedUntil ?? default,
            TierModels = tierModels ?? TierModels.NotSet,
            AvailableModels = available?.ToArray() ?? [],
        };

    static readonly TierModels _namesBalanced = new(ModelName.NotSet, "claude-sonnet-4-5", ModelName.NotSet, ModelName.NotSet);

    [Fact] void should_serve_when_a_tier_names_a_model() =>
        Provider(_namesBalanced).CanServe(_now).ShouldBeTrue();

    [Fact] void should_serve_when_the_provider_published_a_catalog() =>
        Provider(available: [(ModelName)"claude-sonnet-4-5"]).CanServe(_now).ShouldBeTrue();

    // The quiet state: configured, credentialed, and unable to send a single request.
    [Fact] void should_not_serve_when_nothing_resolves_a_model() =>
        Provider().CanServe(_now).ShouldBeFalse();

    [Fact] void should_not_serve_while_the_vendor_is_turning_calls_away() =>
        Provider(_namesBalanced, rateLimitedUntil: _now.AddMinutes(10)).CanServe(_now).ShouldBeFalse();

    // A lapsed cooldown is history, not a state.
    [Fact] void should_serve_once_the_cooldown_has_lapsed() =>
        Provider(_namesBalanced, rateLimitedUntil: _now.AddMinutes(-1)).CanServe(_now).ShouldBeTrue();

    [Fact] void should_not_serve_when_an_empty_mapping_is_all_there_is() =>
        Provider(TierModels.NotSet).CanServe(_now).ShouldBeFalse();
}
