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

        return Enum.GetValues<ModelTier>().Select(tier => ProviderTierResolutions.Resolve(providerId, provider, tier)).ToArray();
    }

    /// <summary>
    /// Previews a proposed mapping without recording it or probing the vendor.
    /// Unset models derive from the recorded catalog, exactly as they would after applying the mapping.
    /// </summary>
    /// <param name="providerId">The provider whose mapping would change.</param>
    /// <param name="fast">The proposed Fast model, or an empty value to derive it.</param>
    /// <param name="balanced">The proposed Balanced model, or an empty value to derive it.</param>
    /// <param name="powerful">The proposed Powerful model, or an empty value to derive it.</param>
    /// <param name="premier">The proposed Premier model, or an empty value to derive it.</param>
    /// <param name="eventStore">The event store the provider is read from.</param>
    /// <returns>One resolution per tier using the proposed mapping, including refusals for an unknown provider.</returns>
    public static async Task<IEnumerable<ProviderTierResolution>> PreviewProviderTierModels(
        AIProviderId providerId,
        ModelName fast,
        ModelName balanced,
        ModelName powerful,
        ModelName premier,
        IEventStore eventStore)
    {
        var provider = providerId == AIProviderId.NotSet
            ? null
            : await eventStore.ReadModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
        var proposed = provider is null ? null : provider with { TierModels = new(fast, balanced, powerful, premier) };

        return Enum.GetValues<ModelTier>().Select(tier => ProviderTierResolutions.Resolve(providerId, proposed, tier)).ToArray();
    }
}
