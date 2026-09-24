// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics.CodeAnalysis;
using Cratis.AI.Common;
using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.OpenAI;
using Cratis.AI.Providers.Reconfiguring;
using Cratis.Arc.Authorization;
using Cratis.Chronicle.Reactors;
using Microsoft.Extensions.Logging;
using CratisAIAdding = Cratis.AI.Providers.Adding;
using CratisAIReconfiguring = Cratis.AI.Providers.Reconfiguring;

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Asks a provider which models it serves the moment it is registered, and again whenever its
/// credential or endpoint changes (#1187).
/// </summary>
/// <remarks>
/// <para>
/// Registering a provider is the moment its catalog is knowable and nobody has yet had a chance to
/// map anything by hand, so it is the right moment to ask: the registration event lands, this asks
/// the vendor, and the catalog and a tier mapping derived from it land on the same stream directly
/// after. That is what a provider being usable straight after being added now means - not a table of
/// model names Direct carried around and hoped was still true.
/// </para>
/// <para>
/// Reconfiguring counts too: a new key can reach a different account with a different catalog, and a
/// changed endpoint points at an entirely different gateway. Both make the recorded catalog a claim
/// about somewhere else.
/// </para>
/// <para>
/// <c>[OnceOnly]</c> because asking a vendor is an external call, and a replay of the provider
/// stream must not spend a round trip per registration that ever happened. Nothing defers here - a
/// failed ask records why it failed, and <see cref="AIProviderModelCatalogPass"/> is what comes back
/// to it - so this is not the deadlock shape <c>[OnceOnly]</c> pairs badly with.
/// </para>
/// </remarks>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> the refresh command runs through.</param>
/// <param name="systemExecution">The <see cref="ISystemExecution"/> the command runs as - a reactor has no HTTP request behind it.</param>
/// <param name="logger">The logger.</param>
[SuppressMessage(
    "Style",
    "IDE0060:Remove unused parameter",
    Justification = "Chronicle dispatches a reactor handler on the type of its event parameter, so every handler below must declare one whether or not it reads it.")]
public class DiscoverModelsWhenProviderAdded(
    ICommandPipeline commandPipeline,
    ISystemExecution systemExecution,
    ILogger<DiscoverModelsWhenProviderAdded> logger) : IReactor
{
    /// <summary>Asks a newly registered Anthropic provider for its catalog.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task AnthropicAdded(CratisAIAdding.AnthropicProviderAdded @event, EventContext context) => Ask(context);

    /// <summary>Asks a newly registered OpenAI provider for its catalog.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task OpenAIAdded(OpenAIProviderAdded @event, EventContext context) => Ask(context);

    /// <summary>Asks a newly registered Azure OpenAI provider for its deployments.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task AzureOpenAIAdded(CratisAIAdding.AzureOpenAIProviderAdded @event, EventContext context) => Ask(context);

    /// <summary>Asks a newly registered OpenAI-compatible gateway for its catalog.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task OpenAICompatibleAdded(CratisAIAdding.OpenAICompatibleProviderAdded @event, EventContext context) => Ask(context);

    /// <summary>Asks a newly registered Z.ai provider for its catalog.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task ZAIAdded(CratisAIAdding.ZAIProviderAdded @event, EventContext context) => Ask(context);

    /// <summary>Asks a reconfigured Anthropic provider for its catalog - a new key can reach a different account.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task AnthropicReconfigured(CratisAIReconfiguring.AnthropicProviderReconfigured @event, EventContext context) => Ask(context);

    /// <summary>Asks a reconfigured OpenAI provider for its catalog.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task OpenAIReconfigured(OpenAIProviderReconfigured @event, EventContext context) => Ask(context);

    /// <summary>Asks a reconfigured Azure OpenAI provider for its deployments - the endpoint may now be a different resource.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task AzureOpenAIReconfigured(CratisAIReconfiguring.AzureOpenAIProviderReconfigured @event, EventContext context) => Ask(context);

    /// <summary>Asks a reconfigured OpenAI-compatible gateway for its catalog - the endpoint may now be a different gateway.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task OpenAICompatibleReconfigured(CratisAIReconfiguring.OpenAICompatibleProviderReconfigured @event, EventContext context) => Ask(context);

    /// <summary>Asks a reconfigured Z.ai provider for its catalog.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public Task ZAIReconfigured(CratisAIReconfiguring.ZAIProviderReconfigured @event, EventContext context) => Ask(context);

    /// <summary>Asks a Codex provider for its catalog once it has a credential to ask with.</summary>
    /// <param name="event">The event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    /// <remarks>
    /// Codex has no credential when it is added - it gets one from the device-code sign-in - so the
    /// registration event is the wrong moment to ask. The sign-in landing is the right one.
    /// </remarks>
    [OnceOnly]
    public Task CodexSignedIn(OpenAISubscriptionCredentialConfigured @event, EventContext context) => Ask(context);

    async Task Ask(EventContext context)
    {
        using var scope = systemExecution.AsSystem();

        var providerId = new AIProviderId(Guid.Parse(context.EventSourceId.Value));
        await commandPipeline.ExecuteAndReport(new RefreshAvailableModels(providerId), logger);
    }
}
