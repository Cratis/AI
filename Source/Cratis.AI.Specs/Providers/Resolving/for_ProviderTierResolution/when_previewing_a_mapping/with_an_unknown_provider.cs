// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.Resolving.for_ProviderTierResolution.when_previewing_a_mapping;

public class with_an_unknown_provider : Specification
{
    readonly AIProviderId _providerId = AIProviderId.New();
    IEventStore _eventStore;
    ProviderTierResolution[] _rows;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        var readModels = Substitute.For<IReadModels>();
        _eventStore.ReadModels.Returns(readModels);
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId).Returns((ConfiguredAIProvider)null!);
    }

    async Task Because() => _rows = (await ProviderTierResolution.PreviewProviderTierModels(
        _providerId, _eventStore, "claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5", "claude-fable-5-1")).ToArray();

    [Fact] void should_refuse_every_tier_despite_the_proposed_models() => _rows.ShouldEachConformTo(row => row.Source == TierModelSource.Unsatisfied);
    [Fact] void should_include_all_tiers() => _rows.Length.ShouldEqual(4);
    [Fact] void should_explain_the_missing_provider() => _rows.ShouldEachConformTo(row => row.Reason.Contains($"AI provider {_providerId} could not be found", StringComparison.Ordinal));
}
