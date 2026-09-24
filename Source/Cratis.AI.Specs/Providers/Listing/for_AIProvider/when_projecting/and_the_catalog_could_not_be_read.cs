// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

/// <summary>
/// A provider whose catalog could not be read says so on its row. Without it the row is
/// indistinguishable from a healthy provider, which is how an unanswerable one went unnoticed until
/// a tier silently resolved to nothing.
/// </summary>
public class and_the_catalog_could_not_be_read : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();

    ReadModelScenario<AIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_providerId).Events(
        new AnthropicProviderAdded("Einars Claude", "sk-ant-oat01-subscription", 4),
        new AIProviderModelDiscoveryFailed("A Claude subscription token cannot read Anthropic's model list.", DateTimeOffset.UtcNow));

    [Fact] void should_carry_the_reason() => _scenario.Instance.ModelDiscoveryFailure.ShouldContain("subscription token");

    [Fact] void should_not_claim_a_catalog_was_published() => _scenario.Instance.ModelsDiscoveredAt.ShouldBeNull();
}
