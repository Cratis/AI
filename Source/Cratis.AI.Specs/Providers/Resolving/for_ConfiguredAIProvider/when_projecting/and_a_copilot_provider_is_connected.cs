// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Copilot;

namespace Cratis.AI.Providers.for_ConfiguredAIProvider.when_projecting;

public class and_a_copilot_provider_is_connected : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    ReadModelScenario<ConfiguredAIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_providerId).Events(
        new CopilotProviderAdded("GitHub Copilot", AIProviderApiKey.NotSet, 3),
        new CopilotProviderConnected("ghp_token", null));

    [Fact] void should_resolve_the_provider() => _scenario.Instance.Id.ShouldEqual(_providerId);
    [Fact] void should_identify_copilot() => _scenario.Instance.Type.ShouldEqual(AIProviderType.Copilot);
    [Fact] void should_resolve_the_credential() => _scenario.Instance.ApiKey.ShouldEqual(new AIProviderApiKey("ghp_token"));
    [Fact] void should_resolve_the_concurrency_limit() => _scenario.Instance.MaxConcurrentJobs.ShouldEqual(new MaxConcurrentJobs(3));
}
