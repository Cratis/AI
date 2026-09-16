// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers;

/// <summary>
/// Resolves a capability tier to the concrete model a provider runs it on - the one place the
/// configured mapping and the vendor defaults meet. Ported unchanged from Direct's
/// <c>AIProviders.TierModelResolution</c> (plan Section 5.2 step 6).
/// </summary>
/// <remarks>
/// Pure so the whole question - "what does <see cref="ModelTier.Premier"/> mean on this provider?" -
/// is directly specifiable. The configured mapping wins per tier; a tier it leaves unset falls back
/// to the vendor default, so a provider configured before tiers existed keeps dispatching exactly
/// as it did, and a partially-mapped provider stays honest everywhere it is deliberate.
/// </remarks>
public static class TierModelResolution
{
    /// <summary>
    /// Resolves a tier to a concrete model on a provider.
    /// </summary>
    /// <param name="configured">The provider's own tier mapping - <see langword="null"/> or <see cref="TierModels.NotSet"/> when none was configured.</param>
    /// <param name="providerType">The vendor the provider talks to, for the defaults.</param>
    /// <param name="tier">The tier being asked for.</param>
    /// <returns>The concrete model, or <see cref="ModelName.NotSet"/> when neither the mapping nor the vendor's defaults name one.</returns>
    public static ModelName Resolve(TierModels? configured, AIProviderType providerType, ModelTier tier)
    {
        var mapped = (configured ?? TierModels.NotSet).For(tier);
        if (!mapped.Equals(ModelName.NotSet))
        {
            return mapped;
        }

        return TierModelDefaults.For(providerType).For(tier);
    }
}
