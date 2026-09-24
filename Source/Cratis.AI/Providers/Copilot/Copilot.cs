// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Monads;

namespace Cratis.AI.Providers.Copilot;

/// <summary>
/// Adds a GitHub Copilot provider, ready to be connected to a GitHub account.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="MaxConcurrentJobs">How many worker jobs may use the entitlement concurrently.</param>
[Command]
public record AddCopilotProvider(AIProviderName Name, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// Opens the provider stream without fabricating a credential, exactly as the Codex provider
    /// does: Copilot has no API key to type in, so the credential arrives from the device sign-in
    /// (or from a pasted GitHub token) afterwards, and no worker can dispatch through the provider
    /// until it has.
    /// </summary>
    /// <returns>The provider identity and added event.</returns>
    public (AIProviderId, CopilotProviderAdded) Handle() =>
        (AIProviderId.New(), new(Name, AIProviderApiKey.NotSet, MaxConcurrentJobs));
}

/// <summary>
/// Validates <see cref="AddCopilotProvider"/>.
/// </summary>
public class AddCopilotProviderValidator : CommandValidator<AddCopilotProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddCopilotProviderValidator"/> class.
    /// </summary>
    public AddCopilotProviderValidator() =>
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
}

/// <summary>
/// Sets a Copilot provider's credential from a GitHub token somebody already holds - the path for a
/// deployment that has no OAuth app to run a device flow through, and for a machine account whose
/// token is managed elsewhere.
/// </summary>
/// <param name="Provider">The provider being configured.</param>
/// <param name="ApiKey">The GitHub token the Copilot CLI will authenticate with.</param>
[Command]
public record ReconfigureCopilotProvider(AIProviderId Provider, AIProviderApiKey ApiKey) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => Provider;

    /// <summary>
    /// Handles the command by recording the credential, refusing anything that could not
    /// authenticate the CLI in the first place.
    /// </summary>
    /// <param name="current">The current provider configuration.</param>
    /// <returns>The connected event, or a validation error.</returns>
    public Result<CopilotProviderConnected, ValidationResult> Handle(ConfiguredAIProvider? current)
    {
        if (current is null || current.Type != AIProviderType.Copilot)
        {
            return ValidationResult.Error("The Copilot provider is not configured");
        }

        // Said here rather than discovered by a container that 401s: Copilot has no API-key form, so
        // a value that is not a GitHub token is not a credential of any kind for this vendor.
        if (!CopilotCredential.IsUsable(ApiKey))
        {
            return ValidationResult.Error(
                "That is not a GitHub token. Copilot authenticates with a GitHub credential (gho_, ghu_, ghp_ or github_pat_), not a vendor API key.");
        }

        var credential = CopilotCredential.Normalize(ApiKey);
        return new CopilotProviderConnected(credential, CopilotCredential.ExpiresAt(credential));
    }
}

/// <summary>
/// Disconnects a Copilot provider from its GitHub account.
/// </summary>
/// <param name="Provider">The provider to disconnect.</param>
[Command]
public record DisconnectCopilotProvider(AIProviderId Provider) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => Provider;

    /// <summary>
    /// Removes the usable credential while preserving the provider configuration for reconnection.
    /// </summary>
    /// <param name="current">The current provider configuration.</param>
    /// <returns>The disconnected event, or a validation error.</returns>
    public Result<CopilotProviderDisconnected, ValidationResult> Handle(ConfiguredAIProvider? current)
    {
        if (current is null || current.Type != AIProviderType.Copilot)
        {
            return ValidationResult.Error("The Copilot provider is not configured");
        }

        return new CopilotProviderDisconnected(AIProviderApiKey.NotSet);
    }
}

/// <summary>
/// Event raised when a GitHub Copilot provider has been added.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="ApiKey">The protected disconnected credential sentinel.</param>
/// <param name="MaxConcurrentJobs">How many worker jobs may use it concurrently.</param>
[EventType]
public record CopilotProviderAdded(AIProviderName Name, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs);

/// <summary>
/// Event raised when a Copilot provider has a credential for a GitHub account - from the device
/// sign-in or from a token somebody supplied.
/// </summary>
/// <param name="ApiKey">The protected GitHub credential.</param>
/// <param name="ExpiresAt">When the credential expires - <see langword="null"/> for a GitHub token that does not, which is the common case.</param>
[EventType]
public record CopilotProviderConnected(AIProviderApiKey ApiKey, DateTimeOffset? ExpiresAt);

/// <summary>
/// Event raised when a Copilot provider has been disconnected from its GitHub account.
/// </summary>
/// <param name="ApiKey">The protected disconnected credential sentinel.</param>
[EventType]
public record CopilotProviderDisconnected(AIProviderApiKey ApiKey);
