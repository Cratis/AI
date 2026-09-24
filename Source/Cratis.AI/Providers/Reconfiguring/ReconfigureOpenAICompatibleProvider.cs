// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Monads;

namespace Cratis.AI.Providers.Reconfiguring;

/// <summary>
/// Command for changing an OpenAI-compatible provider's endpoint and/or API key - a blank API key
/// keeps whatever is already recorded. Ported from Direct's
/// <c>AIProviders.Reconfiguring.ReconfigureOpenAICompatibleProvider</c> (plan Section 5.2 step 4).
/// </summary>
/// <param name="Provider">The provider to reconfigure.</param>
/// <param name="Endpoint">The new endpoint.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureOpenAICompatibleProvider(AIProviderId Provider, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending an <see cref="OpenAICompatibleProviderReconfigured"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public Result<OpenAICompatibleProviderReconfigured, ValidationResult> Handle(ConfiguredAIProvider? current)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        return new OpenAICompatibleProviderReconfigured(
            Endpoint,
            ApiKey.Equals(AIProviderApiKey.NotSet) ? current.ApiKey : ApiKey);
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
        RuleFor(_ => _.Endpoint).NotEqual(AIProviderEndpoint.NotSet).WithMessage("An endpoint is required");
}

/// <summary>
/// Event raised when an OpenAI-compatible provider's endpoint and/or API key has been changed.
/// </summary>
/// <param name="Endpoint">The new endpoint.</param>
/// <param name="ApiKey">The new API key, protected at rest.</param>
[EventType]
public record OpenAICompatibleProviderReconfigured(AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey);
