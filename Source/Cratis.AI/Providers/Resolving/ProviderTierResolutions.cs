// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.Resolving;

/// <summary>
/// Builds the credential-free resolution shared by current and proposed tier queries.
/// </summary>
internal static class ProviderTierResolutions
{
    /// <summary>
    /// Explains one tier from the supplied provider snapshot, without changing it.
    /// </summary>
    /// <param name="providerId">The requested provider, including when it is missing.</param>
    /// <param name="provider">The current or proposed configuration, or null when missing.</param>
    /// <param name="tier">The requested tier.</param>
    /// <returns>The model resolution and recorded discovery status.</returns>
    internal static ProviderTierResolution Resolve(AIProviderId providerId, ConfiguredAIProvider? provider, ModelTier tier)
    {
        var resolution = provider is null
            ? new TierModelResolved(tier, ModelName.NotSet, TierModelSource.Unsatisfied, $"AI provider {providerId} could not be found.")
            : TierModelResolution.Explain(provider, tier);

        return new(
            tier,
            resolution.Model,
            resolution.Source,
            resolution.Reason,
            provider?.ModelDiscoveryFailure ?? string.Empty,
            provider?.ModelsDiscoveredAt ?? default);
    }
}
