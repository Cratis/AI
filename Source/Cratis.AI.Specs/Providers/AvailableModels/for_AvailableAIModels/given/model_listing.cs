// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_AvailableAIModels.given;

public class model_listing : ICanListAvailableModels
{
    public AIProviderType Type => AIProviderType.Anthropic;
    public AIModelDiscoveryResult DiscoveryResult { get; set; } = AIModelDiscoveryResult.Discovered([]);
    public List<ConfiguredAIProvider> DiscoveryCalls { get; } = [];
    public List<ConfiguredAIProvider> LegacyCalls { get; } = [];

    public Task<AIModelDiscoveryResult> Discover(ConfiguredAIProvider provider)
    {
        DiscoveryCalls.Add(provider);
        return Task.FromResult(DiscoveryResult);
    }

    public Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider)
    {
        LegacyCalls.Add(provider);
        return Task.FromResult<IEnumerable<ModelName>>(DiscoveryResult.Models);
    }
}
