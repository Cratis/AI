// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.DependencyInjection;
using Cratis.Types;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Defines asking a vendor which models it currently serves.
/// </summary>
/// <remarks>
/// The answer is not cached and not read at query time any more (#1187). Asking the vendor is an
/// external effect with an outcome worth recording, so it happens once - when a provider is
/// registered, when somebody presses Refresh, and on the catalog pass - and the result is appended
/// to the provider's stream. Everything that needs to know which models a provider serves reads
/// that fact instead of asking again.
/// </remarks>
public interface IAvailableAIModels
{
    /// <summary>
    /// Asks a configured provider for its catalog.
    /// </summary>
    /// <param name="providerId">The provider to ask.</param>
    /// <returns>The outcome - an authentic catalog, or a failure describing why it could not be read.</returns>
    Task<AIModelDiscoveryResult> Discover(AIProviderId providerId);
}

/// <summary>
/// Represents an implementation of <see cref="IAvailableAIModels"/> - resolves the provider, reveals
/// its stored API key at the moment it is spent (the same point-of-use treatment
/// <see cref="ProviderAwareLanguageModel"/> gives a completion) and asks the vendor's own
/// <see cref="ICanListAvailableModels"/>.
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> the provider is resolved from.</param>
/// <param name="listings">Every discovered <see cref="ICanListAvailableModels"/>, one per <see cref="AIProviderType"/>.</param>
/// <param name="logger">The logger.</param>
[Scoped]
public class AvailableAIModels(
    IEventStore eventStore,
    IInstancesOf<ICanListAvailableModels> listings,
    ILogger<AvailableAIModels> logger) : IAvailableAIModels
{
    /// <inheritdoc/>
    public async Task<AIModelDiscoveryResult> Discover(AIProviderId providerId)
    {
        if (providerId == AIProviderId.NotSet)
        {
            return AIModelDiscoveryResult.Failed("No provider was named.");
        }

        // ConfiguredAIProvider is [Passive] - computed on demand from the provider's own events - so
        // this is strongly consistent even a moment after the provider was registered. That is what
        // lets the registration reactor run the same command a person presses Refresh on.
        var provider = await eventStore.ReadModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
        if (provider is null)
        {
            logger.UnknownConfiguredProvider(providerId);
            return AIModelDiscoveryResult.Failed("The configured provider could not be found.");
        }

        var listing = listings.FirstOrDefault(candidate => candidate.Type == provider.Type);
        if (listing is null)
        {
            logger.NoListingForProviderType(provider.Type);
            return AIModelDiscoveryResult.Failed($"{provider.Type} publishes no model catalog - name the models for each tier by hand.");
        }

        try
        {
            // Both credentials are revealed at the moment they are spent, the usage one included:
            // a vendor whose completions credential cannot read its catalog may still answer the
            // second key, and an encrypted value handed to a listing would simply be refused.
            var models = (await listing.List(provider)).ToArray();
            return AIModelDiscoveryResult.Discovered(models);
        }
        catch (ModelCatalogUnavailable exception)
        {
            return AIModelDiscoveryResult.Failed(exception.Message);
        }
    }
}
