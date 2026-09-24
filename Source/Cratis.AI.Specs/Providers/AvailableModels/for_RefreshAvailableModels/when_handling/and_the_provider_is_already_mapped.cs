// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.SettingTierModels;

namespace Cratis.AI.Providers.AvailableModels.for_RefreshAvailableModels.when_handling;

/// <summary>
/// A refresh records what the vendor said and stops there. Re-deriving a mapping an operator chose
/// deliberately would make pressing Refresh a destructive act, which is not what the button says.
/// </summary>
public class and_the_provider_is_already_mapped : Specification
{
    IEnumerable<object> _result;

    void Because() => _result = new RefreshAvailableModels(AIProviderId.New()).Handle(
        new ModelCatalogRefresh(
            AIModelDiscoveryResult.Discovered([new ModelName("claude-opus-4-5"), new ModelName("claude-haiku-4-5")]),
            TierModels.NotSet with { Powerful = new ModelName("deliberately-chosen") },
            DateTimeOffset.UtcNow));

    [Fact] void should_append_only_the_catalog() => _result.Count().ShouldEqual(1);

    [Fact] void should_not_touch_the_mapping() => _result.OfType<AIProviderTierModelsSet>().ShouldBeEmpty();
}
