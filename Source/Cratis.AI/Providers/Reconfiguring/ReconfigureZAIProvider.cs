// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Monads;

namespace Cratis.AI.Providers.Reconfiguring;

/// <summary>
/// Command for changing a Z.ai provider's endpoint and/or API key - a blank API key keeps whatever
/// is already recorded. Ported from Direct's
/// <c>AIProviders.Reconfiguring.ReconfigureZAIProvider</c> (plan Section 5.2 step 4).
/// </summary>
/// <param name="Provider">The provider to reconfigure.</param>
/// <param name="Endpoint">The new endpoint.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureZAIProvider(AIProviderId Provider, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending a <see cref="ZAIProviderReconfigured"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <param name="protector">The <see cref="ISecretProtector"/> a newly supplied key is protected through.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public async Task<Result<ZAIProviderReconfigured, ValidationResult>> Handle(ConfiguredAIProvider? current, ISecretProtector protector)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        return new ZAIProviderReconfigured(
            Endpoint,
            ApiKey.Equals(AIProviderApiKey.NotSet) ? current.ApiKey : (AIProviderApiKey)await protector.Protect(ApiKey));
    }
}

/// <summary>
/// Represents the validator for the <see cref="ReconfigureZAIProvider"/> command.
/// </summary>
public class ReconfigureZAIProviderValidator : CommandValidator<ReconfigureZAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReconfigureZAIProviderValidator"/> class.
    /// </summary>
    public ReconfigureZAIProviderValidator() =>
        RuleFor(_ => _.Endpoint).NotEqual(AIProviderEndpoint.NotSet).WithMessage("An endpoint is required");
}

/// <summary>
/// Event raised when a Z.ai provider's endpoint and/or API key has been changed.
/// </summary>
/// <param name="Endpoint">The new endpoint.</param>
/// <param name="ApiKey">The new API key, protected at rest.</param>
[EventType(EventTypeId)]
public record ZAIProviderReconfigured(AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type. Chosen once, here, and
    /// never changed - see decision 0002.
    /// </summary>
    public const string EventTypeId = "965b0e47-fe1e-43f7-948d-6a8560219468";
}
