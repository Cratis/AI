// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capabilities;

/// <summary>
/// Safe, credential-free capability metadata for an AI provider type.
/// </summary>
/// <param name="Type">The provider type.</param>
/// <param name="Capabilities">The intrinsic capabilities offered by the provider type.</param>
[ReadModel]
public record AIProviderCapabilityDescription(AIProviderType Type, IReadOnlySet<AIProviderCapability> Capabilities)
{
    /// <summary>
    /// Lists capability metadata for every convention-discovered provider descriptor.
    /// </summary>
    /// <returns>The safe provider capability metadata.</returns>
    public static IEnumerable<AIProviderCapabilityDescription> AllAIProviderCapabilities() =>
        Enum.GetValues<AIProviderType>()
            .Select(type => new AIProviderCapabilityDescription(type, AIProviderCapabilities.For(type)));
}
