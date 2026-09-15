// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Monads;

namespace Cratis.AI.Providers.Reconfiguring;

/// <summary>
/// Command for changing an Anthropic provider's API key - a blank value keeps whatever is already
/// recorded, rather than clearing it. Ported from Direct's
/// <c>AIProviders.Reconfiguring.ReconfigureAnthropicProvider</c> (plan Section 5.2 step 4), rewired
/// onto the package's own <see cref="ISecretProtector"/>.
/// </summary>
/// <param name="Provider">The provider to reconfigure.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureAnthropicProvider(AIProviderId Provider, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AnthropicProviderReconfigured"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <param name="protector">The <see cref="ISecretProtector"/> a newly supplied key is protected through.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public async Task<Result<AnthropicProviderReconfigured, ValidationResult>> Handle(ConfiguredAIProvider? current, ISecretProtector protector)
    {
        // A blank key keeps whatever is recorded, so there has to be something recorded to keep.
        // Injected read models can be missing, and a non-nullable parameter would turn that into
        // an exception rather than something a caller can show as a validation failure.
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        return new AnthropicProviderReconfigured(
            ApiKey.Equals(AIProviderApiKey.NotSet) ? current.ApiKey : (AIProviderApiKey)await protector.Protect(ApiKey));
    }
}

/// <summary>
/// Event raised when an Anthropic provider's API key has been changed.
/// </summary>
/// <param name="ApiKey">The new API key, protected at rest.</param>
[EventType]
public record AnthropicProviderReconfigured(AIProviderApiKey ApiKey);
