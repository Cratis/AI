// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers;

/// <summary>
/// A provider's mapping from the package's capability tiers to the concrete models that vendor
/// offers - one model per tier, unset tiers falling back to the vendor's defaults. Ported from
/// Direct's <c>AIProviders.TierModels</c> (plan Section 5.2 step 6).
/// </summary>
/// <remarks>
/// Carried as four named properties rather than a dictionary so the event, the read model and the
/// generated proxy all stay explicit about which tiers exist - a mapping a person cannot
/// accidentally extend with a typo. A tier left at <see cref="ModelName.NotSet"/> means "no
/// deliberate choice" and is derived from the models the provider published,
/// which is also what a provider configured before this mapping existed resolves to.
/// </remarks>
/// <param name="Fast">The vendor's model for <see cref="ModelTier.Fast"/> - <see cref="ModelName.NotSet"/> for the vendor default.</param>
/// <param name="Balanced">The vendor's model for <see cref="ModelTier.Balanced"/> - <see cref="ModelName.NotSet"/> for the vendor default.</param>
/// <param name="Powerful">The vendor's model for <see cref="ModelTier.Powerful"/> - <see cref="ModelName.NotSet"/> for the vendor default.</param>
/// <param name="Premier">The vendor's model for <see cref="ModelTier.Premier"/> - <see cref="ModelName.NotSet"/> for the vendor default.</param>
public record TierModels(
    ModelName Fast,
    ModelName Balanced,
    ModelName Powerful,
    ModelName Premier)
{
    /// <summary>
    /// The mapping with every tier unset - what a provider carries before anyone configures one.
    /// </summary>
    public static readonly TierModels NotSet = new(ModelName.NotSet, ModelName.NotSet, ModelName.NotSet, ModelName.NotSet);

    /// <summary>
    /// The model a tier maps to.
    /// </summary>
    /// <param name="tier">The tier.</param>
    /// <returns>The model, or <see cref="ModelName.NotSet"/> when this mapping does not name one.</returns>
    public ModelName For(ModelTier tier) => tier switch
    {
        ModelTier.Fast => Fast,
        ModelTier.Balanced => Balanced,
        ModelTier.Powerful => Powerful,
        ModelTier.Premier => Premier,
        _ => ModelName.NotSet,
    };

    /// <summary>
    /// Whether every tier is unset - a mapping with nothing deliberate in it.
    /// </summary>
    /// <returns><see langword="true"/> when no tier names a model.</returns>
    public bool IsNotSet() => this == NotSet;
}
