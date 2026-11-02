// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.AvailableModels;
using Cratis.AI.Providers.SettingTierModels;
using Cratis.AI.Providers.UsageReporting.SettingCredential;

namespace Cratis.AI.Providers.for_ConfiguredAIProvider.when_projecting;

public class and_tier_provenance_is_recorded : Specification
{
    readonly AIProviderId _id = AIProviderId.New();
    readonly List<object> _history = [];
    static readonly DateTimeOffset _at = new(2026, 9, 20, 10, 0, 0, TimeSpan.Zero);
    ConfiguredAIProvider _derived;
    ConfiguredAIProvider _unavailable;
    ConfiguredAIProvider _explicit;
    ConfiguredAIProvider _failed;
    ConfiguredAIProvider _recovered;
    ConfiguredAIProvider _unmarked;
    ConfiguredAIProvider _rederived;
    ConfiguredAIProvider _cleared;
    ConfiguredAIProvider _without_fast;
    ConfiguredAIProvider _legacy;
    ConfiguredAIProvider _resavedLegacy;

    async Task Because()
    {
        var reader = Substitute.For<IModelCatalogReader>();
        reader.Read(Arg.Any<string>(), Arg.Any<IEnumerable<KeyValuePair<string, string>>>())
            .Returns([new ModelName("claude-haiku-4-5")]);
        var listing = new AnthropicModelListing(reader);
        var refresh = new RefreshAvailableModels(_id);
        var added = await Project(
            new AnthropicProviderAdded("Fixture provider", "sk-ant-oat01-fixture", 4),
            new AIProviderUsageCredentialSet("fixture-usage-key"));
        _derived = await Project(refresh.Handle(new ModelCatalogRefresh(await listing.Discover(added), added.TierModels, _at)).ToArray());
        var withoutUsage = await Project(new AIProviderUsageCredentialCleared());
        _unavailable = await Project(refresh.Handle(new ModelCatalogRefresh(await listing.Discover(withoutUsage), withoutUsage.TierModels, _at.AddMinutes(1))).ToArray());
        _explicit = await Project(new SetExplicitAIProviderTierModels(_id, _unavailable.TierModels).Handle().ToArray());
        _failed = await Project(refresh.Handle(new ModelCatalogRefresh(AIModelDiscoveryResult.Failed("fixture HTTP 403"), _explicit.TierModels, _at.AddMinutes(2))).ToArray());
        _recovered = await Project(refresh.Handle(new ModelCatalogRefresh(AIModelDiscoveryResult.Discovered([new ModelName("claude-haiku-4-5")]), _failed.TierModels, _at.AddMinutes(3))).ToArray());
        await Project(new AIProviderModelDiscoveryUnavailable("fixture limitation", _at.AddMinutes(4)));
        _rederived = await Project(new AIProviderTierModelsSet(_derived.TierModels), new AIProviderTierModelsProvenanceSet(_derived.TierModels, TierModelMappingSource.Derived));
        await Project(new SetExplicitAIProviderTierModels(_id, _explicit.TierModels).Handle().ToArray());
        _unmarked = await Project(new SetAIProviderTierModels(_id, _explicit.TierModels).Handle());
        _without_fast = await Project(new SetExplicitAIProviderTierModels(_id, TierModels.NotSet with { Balanced = "fixture-balanced" }).Handle().ToArray());
        _cleared = await Project(new SetExplicitAIProviderTierModels(_id, TierModels.NotSet).Handle().ToArray());

        // Independent pre-upgrade history on the same id: values and catalog cannot prove intent.
        object[] legacyHistory =
        [
            new AnthropicProviderAdded("Legacy fixture", "sk-ant-oat01-fixture", 4),
            new AIProviderModelsDiscovered([new ModelName("claude-haiku-4-5")], _at),
            new AIProviderTierModelsSet(_derived.TierModels),
            new AIProviderModelDiscoveryUnavailable("fixture limitation", _at.AddMinutes(1))
        ];
        var legacy = new ReadModelScenario<ConfiguredAIProvider>();
        await legacy.Given.ForEventSource(_id).Events(legacyHistory);
        _legacy = legacy.Instance;
        var resaved = new ReadModelScenario<ConfiguredAIProvider>();
        await resaved.Given.ForEventSource(_id).Events(
            [.. legacyHistory, .. new SetExplicitAIProviderTierModels(_id, _legacy.TierModels).Handle()]);
        _resavedLegacy = resaved.Instance;
    }

    async Task<ConfiguredAIProvider> Project(params object[] events)
    {
        _history.AddRange(events);

        // Replay complete command results as independent historical prefixes.
        var scenario = new ReadModelScenario<ConfiguredAIProvider>();
        await scenario.Given.ForEventSource(_id).Events(_history.ToArray());
        return scenario.Instance ?? throw new InvalidOperationException("Expected the provider history to project a provider.");
    }

    [Fact] void should_record_auto_assignment_as_derived() => _derived.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Derived);
    [Fact] void should_record_the_successful_catalog_status() => _derived.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Discovered);
    [Fact] void should_record_unavailability_after_usage_key_removal() => _unavailable.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Unavailable);
    [Fact] void should_keep_the_old_catalog_for_history() => _unavailable.AvailableModels.ShouldContainOnly(new ModelName("claude-haiku-4-5"));
    [Fact] void should_keep_the_successful_timestamp() => _unavailable.ModelsDiscoveredAt.ShouldEqual(_at);
    [Fact] void should_not_promote_auto_assignment_when_discovery_becomes_unavailable() => _unavailable.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Derived);
    [Fact] void should_refuse_the_auto_assigned_fast_model() => TierModelResolution.Resolve(_unavailable, ModelTier.Fast).ShouldEqual(ModelName.NotSet);
    [Fact] void should_allow_a_deliberate_unchanged_table_save() => _explicit.TierModels.ShouldEqual(_unavailable.TierModels);
    [Fact] void should_record_that_save_as_explicit() => _explicit.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Explicit);
    [Fact] void should_resolve_the_exact_deliberately_saved_fast_model() => TierModelResolution.Resolve(_explicit, ModelTier.Fast).ShouldEqual(_explicit.TierModels.Fast);
    [Fact] void should_not_reclassify_a_real_failure() => _failed.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Failed);
    [Fact] void should_keep_the_real_failure_reason() => _failed.ModelDiscoveryFailure.ShouldEqual("fixture HTTP 403");
    [Fact] void should_not_change_provenance_on_a_failure() => _failed.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Explicit);
    [Fact] void should_reset_the_status_on_success() => _recovered.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Discovered);
    [Fact] void should_clear_the_previous_reason_on_success() => _recovered.ModelDiscoveryFailure.ShouldEqual(string.Empty);
    [Fact] void should_not_change_provenance_on_success() => _recovered.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Explicit);
    [Fact] void should_reset_provenance_for_a_later_legacy_write() => _unmarked.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Unknown);
    [Fact] void should_accept_a_complete_derived_replacement() => _rederived.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Derived);
    [Fact] void should_replace_the_whole_table_when_fast_is_cleared() => _without_fast.TierModels.Fast.ShouldEqual(ModelName.NotSet);
    [Fact] void should_replace_the_whole_table_when_all_tiers_are_cleared() => _cleared.TierModels.ShouldEqual(TierModels.NotSet);
    [Fact] void should_refuse_fast_after_it_is_cleared() => TierModelResolution.Resolve(_without_fast, ModelTier.Fast).ShouldEqual(ModelName.NotSet);
    [Fact] void should_refuse_fast_after_all_tiers_are_cleared() => TierModelResolution.Resolve(_cleared, ModelTier.Fast).ShouldEqual(ModelName.NotSet);
    [Fact] void should_refuse_an_unmarked_replacement() => TierModelResolution.Resolve(_unmarked, ModelTier.Fast).ShouldEqual(ModelName.NotSet);
    [Fact] void should_refuse_a_derived_replacement() => TierModelResolution.Resolve(_rederived, ModelTier.Fast).ShouldEqual(ModelName.NotSet);
    [Fact] void should_not_infer_legacy_provenance() => _legacy.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Unknown);
    [Fact] void should_not_admit_the_legacy_fast_mapping() => TierModelResolution.Resolve(_legacy, ModelTier.Fast).ShouldEqual(ModelName.NotSet);
    [Fact] void should_record_a_deliberate_unchanged_legacy_resave() => _resavedLegacy.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Explicit);
    [Fact] void should_admit_the_legacy_table_only_after_deliberate_resave() => TierModelResolution.Resolve(_resavedLegacy, ModelTier.Fast).ShouldEqual(_legacy.TierModels.Fast);
    [Fact] void should_not_let_the_independent_legacy_history_change_the_explicit_snapshot() => _explicit.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Explicit);
}
