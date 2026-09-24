// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using CratisAIAdding = Cratis.AI.Providers.Adding;
using CratisAIRenaming = Cratis.AI.Providers.Renaming;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

public class and_a_provider_is_added_renamed_and_removed : Specification
{
    static readonly AIProviderId _id = AIProviderId.New();

    ReadModelScenario<AIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new CratisAIAdding.AnthropicProviderAdded("Primary", "sk-ant-test", 5),
                new CratisAIRenaming.AIProviderRenamed("Renamed"));

    [Fact] void should_hold_the_new_name() => _scenario.Instance.Name.ShouldEqual(new AIProviderName("Renamed"));
    [Fact] void should_hold_the_vendor_type() => _scenario.Instance.Type.ShouldEqual(AIProviderType.Anthropic);
    [Fact] void should_hold_the_concurrency_limit() => _scenario.Instance.MaxConcurrentJobs.ShouldEqual(new MaxConcurrentJobs(5));
}
