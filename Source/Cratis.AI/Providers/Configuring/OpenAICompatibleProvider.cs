// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Common;
using Cratis.Monads;

namespace Cratis.AI.Providers.Configuring;

/// <summary>
/// Command for adding an OpenAI-compatible endpoint (Ollama, LocalAI, a gateway) as an AI provider -
/// configures how to reach it only, not a model. Ported from Studio's own
/// <c>Settings.AI.Providers.Adding.AddOpenAICompatibleProvider</c> - see
/// <see cref="AnthropicModelConfigured"/>'s remarks for why this vendor family has its own
/// <c>Configuring</c> namespace, shaped differently from
/// <see cref="Adding.OpenAICompatibleProviderAdded"/>.
/// </summary>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="Endpoint">The base URL of the OpenAI-compatible service.</param>
/// <param name="ApiKey">The API key, empty when the service needs no credential.</param>
[Command]
public record AddOpenAICompatibleProvider(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by generating an identifier and appending an
    /// <see cref="OpenAICompatibleModelConfigured"/> event.
    /// </summary>
    /// <param name="protector">The <see cref="ISecretProtector"/> the key is protected through.</param>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public async Task<(AIProviderId, OpenAICompatibleModelConfigured)> Handle(ISecretProtector protector) =>
        (AIProviderId.New(), new(Name, Endpoint, await protector.Protect(ApiKey), ModelName.NotSet));
}

/// <summary>
/// Represents the validator for the <see cref="AddOpenAICompatibleProvider"/> command.
/// </summary>
public class AddOpenAICompatibleProviderValidator : CommandValidator<AddOpenAICompatibleProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddOpenAICompatibleProviderValidator"/> class.
    /// </summary>
    public AddOpenAICompatibleProviderValidator() =>
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
}

/// <summary>
/// Command for changing the configuration of a model served by an OpenAI-compatible endpoint,
/// keeping its identifier so anything already pointing at the provider keeps working. Ported from
/// Studio's own <c>Settings.AI.Providers.Reconfiguring.ReconfigureOpenAICompatibleProvider</c> - the
/// current-provider null check Studio's own version omits is added here for consistency with every
/// other vendor's Reconfigure in this package; reconfiguring a provider that no longer exists is a
/// validation failure everywhere else, and there is no reason for this one to differ.
/// </summary>
/// <param name="Id">The identifier of the provider to reconfigure.</param>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="Endpoint">The new endpoint.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureOpenAICompatibleProvider(AIProviderId Id, AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending an <see cref="OpenAICompatibleModelConfigured"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <param name="protector">The <see cref="ISecretProtector"/> a newly supplied key is protected through.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public async Task<Result<OpenAICompatibleModelConfigured, ValidationResult>> Handle(ConfiguredAIProvider? current, ISecretProtector protector)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        var apiKey = ApiKey.Equals(AIProviderApiKey.NotSet) ? current.ApiKey : (AIProviderApiKey)await protector.Protect(ApiKey);
        return new OpenAICompatibleModelConfigured(Name, Endpoint, apiKey, ModelName.NotSet);
    }
}

/// <summary>
/// Represents the validator for the <see cref="ReconfigureOpenAICompatibleProvider"/> command.
/// </summary>
public class ReconfigureOpenAICompatibleProviderValidator : CommandValidator<ReconfigureOpenAICompatibleProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReconfigureOpenAICompatibleProviderValidator"/> class.
    /// </summary>
    public ReconfigureOpenAICompatibleProviderValidator() =>
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
}

/// <summary>
/// Event raised when a model has been configured to run against an OpenAI-compatible endpoint -
/// raised both when the provider is first added and whenever its configuration changes. Ported from
/// Studio's own <c>Settings.AI.Providers.Adding.OpenAICompatibleModelConfigured</c> - see
/// <see cref="AnthropicModelConfigured"/>'s remarks for the shape and id-pinning reasoning, which
/// applies identically here.
/// </summary>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="Endpoint">The base URL of the OpenAI-compatible service.</param>
/// <param name="ApiKey">The API key, protected at rest, empty when the service needs no credential.</param>
/// <param name="Model">The identifier the service knows the model by - unset until a future feature sets one.</param>
[EventType(EventTypeId)]
public record OpenAICompatibleModelConfigured(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey, ModelName Model)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - see
    /// <see cref="AnthropicModelConfigured"/>'s remarks.
    /// </summary>
    public const string EventTypeId = "OpenAICompatibleModelConfigured";
}
