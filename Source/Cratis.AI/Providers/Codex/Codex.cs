// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Monads;
namespace Cratis.AI.Providers.Codex;

/// <summary>
/// Adds an OpenAI Codex provider ready to be connected to a ChatGPT account.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="MaxConcurrentJobs">How many worker jobs may use the subscription concurrently.</param>
[Command]
public record AddOpenAICodexProvider(AIProviderName Name, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// Opens the provider stream without fabricating a credential. The device sign-in records the
    /// first usable credential before any worker can dispatch through it.
    /// </summary>
    /// <returns>The provider identity and added event.</returns>
    public (AIProviderId, OpenAICodexProviderAdded) Handle() =>
        (AIProviderId.New(), new(Name, AIProviderApiKey.NotSet, MaxConcurrentJobs));
}

/// <summary>
/// Validates <see cref="AddOpenAICodexProvider"/>.
/// </summary>
public class AddOpenAICodexProviderValidator : CommandValidator<AddOpenAICodexProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddOpenAICodexProviderValidator"/> class.
    /// </summary>
    public AddOpenAICodexProviderValidator() =>
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
}

/// <summary>
/// Disconnects an OpenAI Codex provider from its ChatGPT account.
/// </summary>
/// <param name="Provider">The provider to disconnect.</param>
[Command]
public record DisconnectOpenAICodexProvider(AIProviderId Provider) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => Provider;

    /// <summary>
    /// Removes the usable credential while preserving the provider configuration for reconnection.
    /// </summary>
    /// <param name="current">The current provider configuration.</param>
    /// <returns>The disconnected event, or a validation error.</returns>
    public Result<OpenAICodexProviderDisconnected, ValidationResult> Handle(ConfiguredAIProvider? current)
    {
        if (current is null || current.Type != AIProviderType.OpenAICodex)
        {
            return ValidationResult.Error("The OpenAI Codex provider is not configured");
        }

        return new OpenAICodexProviderDisconnected(AIProviderApiKey.NotSet);
    }
}

/// <summary>
/// Event raised when an OpenAI Codex provider has been added.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="ApiKey">The disconnected credential sentinel.</param>
/// <param name="MaxConcurrentJobs">How many worker jobs may use it concurrently.</param>
[EventType]
public record OpenAICodexProviderAdded(AIProviderName Name, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs);

/// <summary>
/// Event raised when an OpenAI Codex provider has been disconnected from ChatGPT.
/// </summary>
/// <param name="ApiKey">The disconnected credential sentinel.</param>
[EventType]
public record OpenAICodexProviderDisconnected(AIProviderApiKey ApiKey);
