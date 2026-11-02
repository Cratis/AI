// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.SettingTierModels;

namespace Cratis.AI.Providers.SettingExplicitTierModels.for_SetExplicitAIProviderTierModels;

public class when_saving_a_table : Specification
{
    readonly AIProviderId _provider = AIProviderId.New();
    readonly TierModels _models = TierModels.NotSet with { Fast = "fixture-fast" };
    CommandScenario<SetExplicitAIProviderTierModels> _scenario;
    CommandResult _result;
    object[] _events;

    void Establish() => _scenario = new();

    async Task Because()
    {
        var command = new SetExplicitAIProviderTierModels(_provider, _models);
        _events = command.Handle().ToArray();
        _result = await _scenario.Execute(command);
    }

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_emit_the_compatibility_mapping_first() => _events[0].ShouldEqual(new AIProviderTierModelsSet(_models));
    [Fact] void should_emit_explicit_provenance_second() => _events[1].ShouldEqual(new AIProviderTierModelsProvenanceSet(_models, TierModelMappingSource.Explicit));
    [Fact] void should_return_only_the_two_events_in_one_batch() => _events.Length.ShouldEqual(2);

    [Fact]
    async Task should_route_the_compatibility_event_to_the_provider() =>
        await _scenario.ShouldHaveAppendedEvent<SetExplicitAIProviderTierModels, AIProviderTierModelsSet>(
            (EventSourceId)_provider, @event => @event.Models == _models);

    [Fact]
    async Task should_route_the_provenance_event_to_the_same_provider() =>
        await _scenario.ShouldHaveAppendedEvent<SetExplicitAIProviderTierModels, AIProviderTierModelsProvenanceSet>(
            (EventSourceId)_provider, @event => @event.Models == _models && @event.Source == TierModelMappingSource.Explicit);

    [Fact]
    void should_record_the_same_explicit_selection_as_the_legacy_command() =>
        new SetAIProviderTierModels(_provider, _models).Handle().ToArray().ShouldEqual(_events);
}
