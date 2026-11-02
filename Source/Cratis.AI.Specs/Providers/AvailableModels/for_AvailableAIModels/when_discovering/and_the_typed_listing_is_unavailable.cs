// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_AvailableAIModels.when_discovering;

public class and_the_typed_listing_is_unavailable : given.all_dependencies
{
    readonly AIProviderId _id = AIProviderId.New();
    AIModelDiscoveryResult _result;

    void Establish()
    {
        ProviderIs(_id, new(_id, AIProviderType.Anthropic, "fixture-api-key"));
        _anthropicListing.DiscoveryResult = AIModelDiscoveryResult.Unavailable("fixture capability limitation");
    }

    async Task Because() => _result = await _availableModels.Discover(_id);

    [Fact] void should_keep_the_typed_outcome() => _result.Status.ShouldEqual(AIModelDiscoveryStatus.Unavailable);
    [Fact] void should_keep_the_reason() => _result.Failure.ShouldEqual("fixture capability limitation");
    [Fact] void should_call_discovery_once() => _anthropicListing.DiscoveryCalls.Count.ShouldEqual(1);
    [Fact] void should_not_call_the_legacy_method() => _anthropicListing.LegacyCalls.Count.ShouldEqual(0);
}
