// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.Listing;

namespace Cratis.AI.Providers.AvailableModels;

public class when_replaying_a_legacy_discovery_failure : Specification
{
    ConfiguredAIProvider _configured;
    AIProvider _listed;

    async Task Because()
    {
        var id = AIProviderId.New();
        object[] history =
        [
            new AnthropicProviderAdded("Fixture provider", "sk-ant-oat01-fixture", 4),
            new AIProviderModelDiscoveryFailed("A Claude subscription token cannot read the model list without a usage reporting key", default)
        ];
        var configured = new ReadModelScenario<ConfiguredAIProvider>();
        await configured.Given.ForEventSource(id).Events(history);
        _configured = configured.Instance;
        var listed = new ReadModelScenario<AIProvider>();
        await listed.Given.ForEventSource(id).Events(history);
        _listed = listed.Instance;
    }

    [Fact] void should_not_reclassify_the_configured_provider_from_diagnostic_text() => _configured.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Failed);
    [Fact] void should_not_reclassify_the_public_listing_from_diagnostic_text() => _listed.ModelDiscoveryStatus.ShouldEqual(AIModelDiscoveryStatus.Failed);
}
