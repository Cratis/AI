// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using CratisAIAdding = Cratis.AI.Providers.Adding;
using CratisAIReconfiguring = Cratis.AI.Providers.Reconfiguring;

namespace Cratis.AI.Providers.when_projecting;

/// <summary>
/// Reproduces the exact production event sequence for a configured Anthropic provider - added, then
/// its API key reconfigured - to prove or disprove whether <see cref="ConfiguredAIProvider"/>'s
/// passive projection itself is where a provider stops resolving.
/// </summary>
public class and_added_then_reconfigured : Specification
{
    readonly AIProviderId _id = AIProviderId.New();
    ReadModelScenario<ConfiguredAIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new CratisAIAdding.AnthropicProviderAdded("Production Anthropic", "enc:v1:original-cipher", 0),
                new CratisAIReconfiguring.AnthropicProviderReconfigured("enc:v1:reconfigured-cipher"));

    [Fact] void should_be_anthropic() => _scenario.Instance.Type.ShouldEqual(AIProviderType.Anthropic);
    [Fact] void should_hold_the_reconfigured_api_key() => _scenario.Instance.ApiKey.ShouldEqual((AIProviderApiKey)"enc:v1:reconfigured-cipher");
    [Fact] void should_resolve_by_id() => _scenario.Instance.Id.ShouldEqual(_id);
}
