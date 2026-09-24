// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

/// <summary>
/// A discovery that succeeds after one that failed must leave no trace of the failure - otherwise
/// the row keeps warning about a provider that is now perfectly answerable.
/// </summary>
public class and_a_catalog_was_published : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    static readonly DateTimeOffset _discoveredAt = new(2026, 9, 20, 9, 30, 0, TimeSpan.Zero);

    ReadModelScenario<AIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_providerId).Events(
        new AnthropicProviderAdded("Einars Claude", "sk-ant-key", 4),
        new AIProviderModelDiscoveryFailed("Anthropic returned HTTP 401.", _discoveredAt.AddHours(-1)),
        new AIProviderModelsDiscovered([new ModelName("claude-opus-4-5"), new ModelName("claude-haiku-4-5")], _discoveredAt));

    [Fact] void should_stamp_when_the_catalog_was_published() => _scenario.Instance.ModelsDiscoveredAt.ShouldEqual(_discoveredAt);

    [Fact] void should_clear_the_earlier_failure() => _scenario.Instance.ModelDiscoveryFailure.ShouldEqual(string.Empty);
}
