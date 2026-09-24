// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers.SettingTierModels;
using Cratis.Chronicle;

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Command for asking a provider which models it currently serves and recording the answer (#1187).
/// </summary>
/// <remarks>
/// <para>
/// Direct used to ask the vendor on every query and cache the answer in memory for five minutes,
/// which made "which models does this provider have" a question with a different answer depending
/// on which process asked and when - and made a vendor outage look like a provider with no models.
/// Asking is now an act with a recorded outcome: this command appends either the catalog the vendor
/// published or the reason it could not be read, on the provider's own stream, and every surface
/// reads that fact.
/// </para>
/// <para>
/// It runs from three places, and does exactly the same thing in all three: the registration
/// reactor the moment a provider is added, the Refresh button in Settings, and the catalog pass that
/// keeps catalogs from going stale and retries the ones that failed.
/// </para>
/// </remarks>
/// <param name="Provider">The provider to ask - the identity the events' stream is bound to.</param>
[Command]
public record RefreshAvailableModels(AIProviderId Provider) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => Provider;

    /// <summary>
    /// Asks the vendor, and reads what the provider already has, so <see cref="Handle"/> is left
    /// with nothing but the decision about which facts that makes true.
    /// </summary>
    /// <param name="availableModels">The catalog discovery.</param>
    /// <param name="eventStore">The <see cref="IEventStore"/> the provider is read from.</param>
    /// <param name="timeProvider">The clock the discovery is stamped with.</param>
    /// <returns>What was discovered, and what the provider already had.</returns>
    public async Task<ModelCatalogRefresh> Provide(IAvailableAIModels availableModels, IEventStore eventStore, TimeProvider timeProvider)
    {
        var provider = await eventStore.ReadModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)Provider);

        return new(await availableModels.Discover(Provider), provider?.TierModels, timeProvider.GetUtcNow());
    }

    /// <summary>
    /// Handles the command by recording what the vendor answered.
    /// </summary>
    /// <param name="refresh">What <see cref="Provide"/> found.</param>
    /// <returns>The events - the discovery outcome, and a derived tier mapping when the provider has none of its own.</returns>
    /// <remarks>
    /// Two events on a first successful discovery, which is the shape a registration produces: the
    /// catalog is the vendor's fact, and the tier mapping derived from it is Direct's. Deriving only
    /// when the provider has no mapping of its own is what keeps a deliberate mapping deliberate - a
    /// refresh never silently re-decides what an operator already decided.
    /// </remarks>
    public IEnumerable<object> Handle(ModelCatalogRefresh refresh)
    {
        if (!refresh.Result.Succeeded)
        {
            return [new AIProviderModelDiscoveryFailed(refresh.Result.Failure, refresh.At)];
        }

        var events = new List<object> { new AIProviderModelsDiscovered(refresh.Result.Models, refresh.At) };
        if (refresh.Configured?.IsNotSet() != false)
        {
            var derived = TierModelAssignment.From(refresh.Result.Models);
            if (!derived.IsNotSet()) events.Add(new AIProviderTierModelsSet(derived));
        }

        return events;
    }
}

/// <summary>
/// What one refresh found - the vendor's answer, what the provider had already been mapped to, and
/// when the asking happened.
/// </summary>
/// <param name="Result">The vendor's answer.</param>
/// <param name="Configured">The provider's own tier mapping, <see langword="null"/> when it has none.</param>
/// <param name="At">When the vendor was asked.</param>
public record ModelCatalogRefresh(AIModelDiscoveryResult Result, TierModels? Configured, DateTimeOffset At);

/// <summary>
/// Event raised when a provider published the models it currently serves. The authentic catalog, as
/// the vendor named it - Direct adds nothing to it and assumes nothing that is not in it.
/// </summary>
/// <param name="Models">The model identifiers the provider published, exactly as it addresses them.</param>
/// <param name="DiscoveredAt">When the provider was asked.</param>
[EventType]
public record AIProviderModelsDiscovered(IEnumerable<ModelName> Models, DateTimeOffset DiscoveredAt);

/// <summary>
/// Event raised when a provider could not be asked which models it serves - a credential the catalog
/// endpoint rejects, a vendor that publishes no catalog at all, or an outage. Recorded rather than
/// swallowed, because an empty catalog and an unanswered question look identical everywhere else and
/// mean entirely different things.
/// </summary>
/// <param name="Reason">Why the catalog could not be read, in words an operator can act on.</param>
/// <param name="AttemptedAt">When the provider was asked.</param>
[EventType]
public record AIProviderModelDiscoveryFailed(string Reason, DateTimeOffset AttemptedAt);

/// <summary>
/// One row in the discovered catalog, enriched with what Direct knows about the model - what the
/// model pickers in Settings bind to.
/// <para>
/// <c>[Passive]</c>, so it is computed on demand from the provider's own events rather than
/// materialized - which is what makes it strongly consistent by key. A refresh appends its event and
/// the next read sees it, with no projection to be behind: the reason the dialog used to need a
/// cache invalidation dance and still showed a stale answer.
/// </para> A sentinel row carries the reason discovery failed, which is
/// what keeps "this provider serves no models" and "nobody could ask" apart on a surface that would
/// otherwise render both as an empty list.
/// </summary>
/// <param name="Id">The exact model id, or <see cref="ModelName.NotSet"/> for a sentinel row.</param>
/// <param name="DisplayName">The friendly model name.</param>
/// <param name="Capabilities">Known model capabilities.</param>
/// <param name="HasModel">Whether this row describes a model.</param>
/// <param name="Failure">Why the catalog could not be read, or an empty string when it was.</param>
/// <param name="DiscoveredAt">When the provider was last asked - the default when it never has been.</param>
[ReadModel]
[Passive]
public record AvailableAIModelDiscovery(
    ModelName Id,
    string DisplayName,
    IReadOnlyList<AIModelCapability> Capabilities,
    bool HasModel,
    string Failure,
    DateTimeOffset DiscoveredAt)
{
    /// <summary>
    /// Gets the catalog a provider published at its last discovery.
    /// </summary>
    /// <param name="providerId">The provider whose catalog to read.</param>
    /// <param name="eventStore">The <see cref="IEventStore"/> the provider is read from.</param>
    /// <returns>Model rows, or one sentinel row when the catalog is empty or was never read.</returns>
    public static async Task<IEnumerable<AvailableAIModelDiscovery>> DiscoverModelsFor(AIProviderId providerId, IEventStore eventStore)
    {
        var provider = providerId == AIProviderId.NotSet
            ? null
            : await eventStore.ReadModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);

        if (provider is null)
        {
            return [DiscoverySentinels.For("The configured provider could not be found.", default)];
        }

        var models = provider.AvailableModels.ToArray();
        if (models.Length == 0)
        {
            var reason = string.IsNullOrEmpty(provider.ModelDiscoveryFailure)
                ? "This provider has not published a model catalog yet - press Refresh to ask it."
                : provider.ModelDiscoveryFailure;
            return [DiscoverySentinels.For(reason, provider.ModelsDiscoveredAt)];
        }

        return models.Select(name => new AvailableAIModelDiscovery(
            name,
            AIModelCapabilities.DisplayNameFor(name),
            [.. AIModelCapabilities.For(name)],
            true,
            string.Empty,
            provider.ModelsDiscoveredAt));
    }
}

/// <summary>
/// Builds the sentinel row. Deliberately not a static method on the read model itself - Arc turns
/// every public static method on a <c>[ReadModel]</c> into an HTTP query, and this is a constructor
/// helper rather than something anyone should be able to ask for.
/// </summary>
static class DiscoverySentinels
{
    /// <summary>
    /// The single row that carries a failure instead of a model, so a caller that renders a list
    /// always has something to render and never has to special-case an empty one.
    /// </summary>
    /// <param name="failure">Why no models can be listed.</param>
    /// <param name="at">When the attempt was made.</param>
    /// <returns>The sentinel row.</returns>
    public static AvailableAIModelDiscovery For(string failure, DateTimeOffset at) =>
        new(ModelName.NotSet, string.Empty, [], false, failure, at);
}
