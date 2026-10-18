// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Agents.Listing.for_AgentTierPreview.when_previewing_a_tier;

public class with_several_pool_members : given.an_agent
{
    readonly AIProviderId _borrowed = AIProviderId.New();
    readonly AIProviderId _missing = AIProviderId.New();
    readonly AIProviderId _refused = AIProviderId.New();
    readonly DateTimeOffset _discoveredAt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero);

    void Establish()
    {
        _readModels.GetInstanceById<Agent>((EventSourceId)_agentId).Returns(_agent with { ProviderId = null, PoolId = _poolId });
        _readModels.GetInstanceById<AIProviderPool>((EventSourceId)_poolId).Returns(new AIProviderPool(_poolId, "Preview pool", [new(_providerId), new(_borrowed), new(_missing), new(_refused)]));
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId).Returns(new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, "sk-ant-test")
        {
            AvailableModels = [new("claude-haiku-4-5")]
        });
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_borrowed).Returns(new ConfiguredAIProvider(_borrowed, AIProviderType.Anthropic, "sk-ant-test")
        {
            AvailableModels = [new("claude-sonnet-4-5")]
        });
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_missing).Returns((ConfiguredAIProvider)null!);
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_refused).Returns(new ConfiguredAIProvider(_refused, AIProviderType.Anthropic, "sk-ant-test")
        {
            TierModels = new("retired-model", ModelName.NotSet, ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new("claude-haiku-4-5")],
            ModelsDiscoveredAt = _discoveredAt,
            ModelDiscoveryFailure = "Last refresh failed"
        });
    }

    async Task Because() => _rows = (await AgentTierPreview.PreviewAgentTier(_agentId, ModelTier.Fast, _readModels)).ToArray();

    [Fact] void should_include_every_member_even_if_refused() => _rows.Select(row => row.ProviderId).ShouldContainOnly(_providerId, _borrowed, _missing, _refused);
    [Fact] void should_identify_the_pool_on_every_row() => _rows.ShouldEachConformTo(row => row.PoolId == _poolId);
    [Fact] void should_derive_from_the_members_own_catalog() => _rows.Single(row => row.ProviderId == _providerId).Resolution.Model.ShouldEqual((ModelName)"claude-haiku-4-5");
    [Fact] void should_report_a_derived_source() => _rows.Single(row => row.ProviderId == _providerId).Resolution.Source.ShouldEqual(TierModelSource.Derived);
    [Fact] void should_resolve_the_borrowed_model() => _rows.Single(row => row.ProviderId == _borrowed).Resolution.Model.ShouldEqual((ModelName)"claude-sonnet-4-5");
    [Fact] void should_report_a_borrowed_source() => _rows.Single(row => row.ProviderId == _borrowed).Resolution.Source.ShouldEqual(TierModelSource.Borrowed);
    [Fact] void should_explain_the_borrowed_rung() => _rows.Single(row => row.ProviderId == _borrowed).Resolution.Reason.ShouldContain("Everyday");
    [Fact] void should_refuse_a_missing_provider() => _rows.Single(row => row.ProviderId == _missing).Resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_explain_a_missing_provider() => _rows.Single(row => row.ProviderId == _missing).Resolution.Reason.ShouldContain("could not be found");
    [Fact] void should_refuse_the_stale_mapping() => _rows.Single(row => row.ProviderId == _refused).Resolution.Model.ShouldEqual(ModelName.NotSet);
    [Fact] void should_explain_the_refused_mapping() => _rows.Single(row => row.ProviderId == _refused).Resolution.Reason.ShouldContain("retired-model");
    [Fact] void should_preserve_catalog_status() => _rows.Single(row => row.ProviderId == _refused).Resolution.ModelsDiscoveredAt.ShouldEqual(_discoveredAt);
    [Fact] void should_preserve_the_last_discovery_failure() => _rows.Single(row => row.ProviderId == _refused).Resolution.ModelDiscoveryFailure.ShouldEqual("Last refresh failed");
}
