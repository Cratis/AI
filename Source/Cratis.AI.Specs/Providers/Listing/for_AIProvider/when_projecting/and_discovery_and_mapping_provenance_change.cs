// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.AvailableModels;
using Cratis.AI.Providers.SettingTierModels;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

public class and_discovery_and_mapping_provenance_change : Specification
{
    readonly AIProviderId _id = AIProviderId.New();
    static readonly DateTimeOffset _at = new(2026, 9, 20, 10, 0, 0, TimeSpan.Zero);
    readonly List<object> _history = [];
    AIProvider _unavailable;
    AIProvider _failed;
    AIProvider _recovered;
    AIProvider _unmarked;
    AIProvider _derived;

    async Task Because()
    {
        var models = TierModels.NotSet with { Fast = "fixture-fast" };
        await Project(new AnthropicProviderAdded("Fixture provider", "fixture-api-key", 4));
        await Project(new AIProviderModelsDiscovered([new ModelName("fixture-fast")], _at));
        await Project(new SetExplicitAIProviderTierModels(_id, models).Handle().ToArray());
        _unavailable = await Project(new AIProviderModelDiscoveryUnavailable("fixture limitation", _at.AddMinutes(1)));
        _failed = await Project(new AIProviderModelDiscoveryFailed("fixture HTTP 403", _at.AddMinutes(2)));
        _recovered = await Project(new AIProviderModelsDiscovered([], _at.AddMinutes(3)));
        _unmarked = await Project(new AIProviderTierModelsSet(models));
        _derived = await Project(new AIProviderTierModelsSet(models), new AIProviderTierModelsProvenanceSet(models, TierModelMappingSource.Derived));
    }

    async Task<AIProvider> Project(params object[] events)
    {
        _history.AddRange(events);
        var scenario = new ReadModelScenario<AIProvider>();
        await scenario.Given.ForEventSource(_id).Events(_history.ToArray());
        return scenario.Instance ?? throw new InvalidOperationException("Expected the provider history to project a provider.");
    }

    [Fact] void should_keep_the_current_unavailability_reason() => _unavailable.ModelDiscoveryFailure.ShouldEqual("fixture limitation");
    [Fact] void should_record_the_latest_status() => _unavailable.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Unavailable);
    [Fact] void should_retain_the_last_successful_timestamp() => _unavailable.ModelsDiscoveredAt.ShouldEqual(_at);
    [Fact] void should_retain_explicit_mapping_provenance() => _unavailable.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Explicit);
    [Fact] void should_keep_mapping_values() => _unavailable.TierModels!.Fast.ShouldEqual(new ModelName("fixture-fast"));
    [Fact] void should_reset_status_after_a_real_failure() => _failed.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Failed);
    [Fact] void should_keep_the_actual_failure() => _failed.ModelDiscoveryFailure.ShouldEqual("fixture HTTP 403");
    [Fact] void should_reset_status_after_success() => _recovered.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Discovered);
    [Fact] void should_clear_the_failure_after_success() => _recovered.ModelDiscoveryFailure.ShouldEqual(string.Empty);
    [Fact] void should_not_promote_mapping_provenance_on_discovery() => _recovered.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Explicit);
    [Fact] void should_clear_explicit_authority_on_an_unmarked_replacement() => _unmarked.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Unknown);
    [Fact] void should_accept_derived_provenance() => _derived.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Derived);

    [Fact]
    void should_preserve_the_listing_constructor() =>
        new AIProvider(_id, "Fixture", AIProviderType.Anthropic).ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.NotAttempted);
}
