// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.Chronicle;

namespace Cratis.AI.Providers.Resolving;

/// <summary>
/// A provider's effective tier mapping, computed from its current configuration and last catalog.
/// Discovery failures remain visible even when an explicit mapping is trusted without a catalog.
/// </summary>
/// <param name="Tier">The requested tier.</param>
/// <param name="Model">The usable model, or <see cref="ModelName.NotSet"/> when refused.</param>
/// <param name="Source">How the model was chosen.</param>
/// <param name="Reason">Why a tier is refused or borrowed.</param>
/// <param name="ModelDiscoveryFailure">Why the last catalog read failed, empty when it succeeded.</param>
/// <param name="ModelsDiscoveredAt">When a catalog was last read successfully, default before discovery.</param>
[ReadModel]
[Passive]
public record ProviderTierResolution(
    ModelTier Tier,
    ModelName Model,
    TierModelSource Source,
    string Reason,
    string ModelDiscoveryFailure,
    DateTimeOffset ModelsDiscoveredAt)
{
    /// <summary>
    /// Resolves all four tiers using the same rules as completions and conversations.
    /// This reads recorded discovery; it does not probe the vendor or verify subscription entitlement.
    /// </summary>
    /// <param name="providerId">The provider whose tiers to explain.</param>
    /// <param name="eventStore">The event store the provider is read from.</param>
    /// <returns>One row per tier, including refusals when the provider cannot be found.</returns>
    public static async Task<IEnumerable<ProviderTierResolution>> ResolveTiersFor(AIProviderId providerId, IEventStore eventStore)
    {
        var provider = providerId == AIProviderId.NotSet
            ? null
            : await eventStore.ReadModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);

        return Enum.GetValues<ModelTier>().Select(tier =>
        {
            var resolution = provider is null
                ? new TierModelResolved(tier, ModelName.NotSet, TierModelSource.Unsatisfied, $"AI provider {providerId} could not be found.")
                : TierModelResolution.Explain(provider, tier);

            return new ProviderTierResolution(
                tier,
                resolution.Model,
                resolution.Source,
                resolution.Reason,
                provider?.ModelDiscoveryFailure ?? string.Empty,
                provider?.ModelsDiscoveredAt ?? default);
        }).ToArray();
    }
}
