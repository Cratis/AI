// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;

namespace Cratis.AI.Providers.Adding;

/// <summary>
/// Command for adding an OpenAI-compatible AI provider - a self-hosted or third-party endpoint that
/// speaks OpenAI's chat-completions API shape (Ollama, LocalAI, and similar). The API key is
/// optional: many local gateways accept requests unauthenticated. Ported from Direct's
/// <c>AIProviders.Adding.AddOpenAICompatibleProvider</c> (plan Section 5.2 step 4).
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="Endpoint">The endpoint to send chat-completions requests to.</param>
/// <param name="ApiKey">The API key, when the endpoint requires one.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on it at once - zero for no limit.</param>
[Command]
public record AddOpenAICompatibleProvider(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// Handles the command by opening a new provider stream and appending an
    /// <see cref="OpenAICompatibleProviderAdded"/> event, with the API key protected at rest.
    /// </summary>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public (AIProviderId, OpenAICompatibleProviderAdded) Handle() =>
        (AIProviderId.New(), new(Name, Endpoint, ApiKey, MaxConcurrentJobs));
}

/// <summary>
/// Represents the validator for the <see cref="AddOpenAICompatibleProvider"/> command.
/// </summary>
public class AddOpenAICompatibleProviderValidator : CommandValidator<AddOpenAICompatibleProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddOpenAICompatibleProviderValidator"/> class.
    /// </summary>
    public AddOpenAICompatibleProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.Endpoint).NotEqual(AIProviderEndpoint.NotSet).WithMessage("An endpoint is required");
    }
}

/// <summary>
/// Event raised when an OpenAI-compatible AI provider has been added.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="Endpoint">The endpoint to send chat-completions requests to.</param>
/// <param name="ApiKey">The API key, when the endpoint requires one, protected at rest.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on the provider at once - zero for no limit.</param>
[EventType]
public record OpenAICompatibleProviderAdded(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs);
