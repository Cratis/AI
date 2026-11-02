// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.AvailableModels;
using Cratis.AI.Providers.SettingTierModels;
using Cratis.AI.Providers.UsageReporting.SettingCredential;

namespace Cratis.AI.Providers.for_ConfiguredAIProvider.when_projecting;

/// <summary>
/// Real command results replayed through the projection, then resolved - the path a provider takes
/// from the periodic sweep to the agent that asks it for a tier.
/// </summary>
public class and_the_tier_table_origin_is_recorded : Specification
{
    static readonly DateTimeOffset _at = new(2026, 9, 20, 10, 0, 0, TimeSpan.Zero);
    ConfiguredAIProvider _subscriptionSwept;
    ConfiguredAIProvider _subscriptionSweptAgain;
    ConfiguredAIProvider _derived;
    ConfiguredAIProvider _derivedUnavailable;
    ConfiguredAIProvider _saved;
    ConfiguredAIProvider _savedFailed;
    ConfiguredAIProvider _savedRecovered;
    ConfiguredAIProvider _legacy;

    async Task Because()
    {
        var reader = Substitute.For<IModelCatalogReader>();
        reader.Read(Arg.Any<string>(), Arg.Any<IEnumerable<KeyValuePair<string, string>>>())
            .Returns([new ModelName("claude-haiku-4-5")]);
        var listing = new AnthropicModelListing(reader);

        // A Claude subscription without a usage key, swept after the upgrade: it never had a table.
        var subscription = new History(AIProviderId.New());
        var added = await subscription.Project(new AnthropicProviderAdded("Subscription", "sk-ant-oat01-fixture", 4));
        _subscriptionSwept = await subscription.Refresh(listing, added, _at);
        _subscriptionSweptAgain = await subscription.Refresh(listing, _subscriptionSwept, _at.AddHours(1));

        // A subscription whose usage key let discovery derive a table, then lost the key.
        var derived = new History(AIProviderId.New());
        var withUsage = await derived.Project(
            new AnthropicProviderAdded("Derived", "sk-ant-oat01-fixture", 4),
            new AIProviderUsageCredentialSet("fixture-usage-key"));
        _derived = await derived.Refresh(listing, withUsage, _at);
        var withoutUsage = await derived.Project(new AIProviderUsageCredentialCleared());
        _derivedUnavailable = await derived.Refresh(listing, withoutUsage, _at.AddMinutes(1));
        _saved = await derived.Project(new SetAIProviderTierModels(derived.Id, _derivedUnavailable.TierModels).Handle());
        _savedFailed = await derived.Project(new RefreshAvailableModels(derived.Id).Handle(
            new ModelCatalogRefresh(AIModelDiscoveryResult.Failed("fixture HTTP 403"), _saved.TierModels, _at.AddMinutes(2))).ToArray());
        _savedRecovered = await derived.Project(new RefreshAvailableModels(derived.Id).Handle(
            new ModelCatalogRefresh(AIModelDiscoveryResult.Discovered([new ModelName("claude-haiku-4-5")]), _savedFailed.TierModels, _at.AddMinutes(3))).ToArray());

        // History recorded before derivations were marked: a catalog-derived table looks like any other.
        var legacy = new History(AIProviderId.New());
        _legacy = await legacy.Project(
            new AnthropicProviderAdded("Legacy", "sk-ant-oat01-fixture", 4),
            new AIProviderModelsDiscovered([new ModelName("claude-haiku-4-5")], _at),
            new AIProviderTierModelsSet(TierModels.NotSet with { Fast = "claude-haiku-4-5" }),
            new AIProviderModelDiscoveryUnavailable("fixture limitation", _at.AddMinutes(1)));
    }

    [Fact] void should_record_the_sweep_as_unavailable() => _subscriptionSwept.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Unavailable);
    [Fact] void should_record_no_table_for_the_swept_subscription() => _subscriptionSwept.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Unknown);
    [Fact] void should_resolve_the_swept_subscription_through_its_alias() => TierModelResolution.Explain(_subscriptionSwept, ModelTier.Balanced).ShouldEqual(new TierModelResolved(ModelTier.Balanced, "sonnet", TierModelSource.SubscriptionAlias, string.Empty));
    [Fact] void should_keep_resolving_after_a_repeated_sweep() => TierModelResolution.Resolve(_subscriptionSweptAgain, ModelTier.Powerful).ShouldEqual(new ModelName("opus"));

    [Fact] void should_mark_a_derived_table() => _derived.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Derived);
    [Fact] void should_resolve_the_derived_table_while_discovery_works() => TierModelResolution.Resolve(_derived, ModelTier.Fast).ShouldEqual(new ModelName("claude-haiku-4-5"));
    [Fact] void should_keep_the_mark_when_discovery_becomes_unavailable() => _derivedUnavailable.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Derived);
    [Fact] void should_refuse_the_derived_table_once_discovery_is_unavailable() => TierModelResolution.Explain(_derivedUnavailable, ModelTier.Fast).Source.ShouldEqual(TierModelSource.Unsatisfied);

    [Fact] void should_clear_the_mark_when_the_operator_saves_the_same_table() => _saved.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Unknown);
    [Fact] void should_resolve_the_saved_table() => TierModelResolution.Resolve(_saved, ModelTier.Fast).ShouldEqual(new ModelName("claude-haiku-4-5"));
    [Fact] void should_resolve_every_tier_of_the_saved_table_as_a_failed_discovery_does() => ResolvesAsAFailedDiscovery(_saved);
    [Fact] void should_not_change_the_origin_on_a_failure() => _savedFailed.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Unknown);
    [Fact] void should_not_rederive_over_a_saved_table() => _savedRecovered.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Unknown);

    [Fact] void should_not_infer_an_origin_for_legacy_history() => _legacy.TierModelMappingSource.ShouldEqual(TierModelMappingSource.Unknown);
    [Fact] void should_keep_resolving_the_legacy_table() => TierModelResolution.Resolve(_legacy, ModelTier.Fast).ShouldEqual(new ModelName("claude-haiku-4-5"));
    [Fact] void should_resolve_every_legacy_tier_as_a_failed_discovery_does() => ResolvesAsAFailedDiscovery(_legacy);

    static void ResolvesAsAFailedDiscovery(ConfiguredAIProvider provider)
    {
        provider.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Unavailable);
        foreach (var tier in Enum.GetValues<ModelTier>())
        {
            var resolved = TierModelResolution.Explain(provider, tier);
            resolved.ShouldEqual(TierModelResolution.Explain(provider with { ModelDiscoveryStatus = AIModelDiscoveryStatus.Failed }, tier));
            resolved.Model.ShouldNotEqual(ModelName.NotSet);
        }
    }

    sealed class History(AIProviderId id)
    {
        readonly List<object> _events = [];

        public AIProviderId Id => id;

        public async Task<ConfiguredAIProvider> Project(params object[] events)
        {
            _events.AddRange(events);

            // Replay the whole history each time, as a read model rebuilt from the log would see it.
            var scenario = new ReadModelScenario<ConfiguredAIProvider>();
            await scenario.Given.ForEventSource(id).Events(_events.ToArray());
            return scenario.Instance ?? throw new InvalidOperationException("Expected the provider history to project a provider.");
        }

        public async Task<ConfiguredAIProvider> Refresh(AnthropicModelListing listing, ConfiguredAIProvider current, DateTimeOffset at) =>
            await Project(new RefreshAvailableModels(id).Handle(new ModelCatalogRefresh(
                await listing.Discover(current),
                current.TierModels,
                at,
                current.ModelDiscoveryStatus,
                current.ModelDiscoveryFailure)).ToArray());
    }
}
