// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers;

/// <summary>
/// Resolves a capability tier to the concrete model a provider runs it on - the one place an
/// operator's mapping and the provider's own catalog meet.
/// </summary>
/// <remarks>
/// Pure so the whole question - "what does <see cref="ModelTier.Premier"/> mean on this provider?" -
/// is directly specifiable. The configured mapping wins per tier; a tier it leaves unset is derived
/// from the models the provider published, so a provider configured before tiers existed still
/// dispatches somewhere, and a partially-mapped provider stays deliberate everywhere it was mapped.
/// <para>
/// The fallback used to be a hardcoded per-vendor table. A table is a claim about someone else's
/// catalog that nothing keeps true: it named models that had been renamed and one that never
/// existed, and a tier resolving to a name the vendor does not serve is a dispatch that silently
/// lands on whatever the harness defaults to. Deriving from the catalog cannot name a model the
/// provider did not publish, which is the property the table could never have.
/// </para>
/// </remarks>
public static class TierModelResolution
{
    /// <summary>
    /// Resolves a tier to a concrete model on a provider.
    /// </summary>
    /// <param name="configured">The provider's own tier mapping - <see langword="null"/> or <see cref="TierModels.NotSet"/> when none was configured.</param>
    /// <param name="available">The models the provider published, that an unmapped tier is derived from.</param>
    /// <param name="tier">The tier being asked for.</param>
    /// <returns>The concrete model, or <see cref="ModelName.NotSet"/> when neither the mapping nor the catalog yields one.</returns>
    public static ModelName Resolve(TierModels? configured, IEnumerable<ModelName>? available, ModelTier tier)
    {
        var mapped = (configured ?? TierModels.NotSet).For(tier);
        if (!mapped.Equals(ModelName.NotSet))
        {
            return mapped;
        }

        return TierModelAssignment.From(available).For(tier);
    }
}
