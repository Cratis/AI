// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;

namespace Cratis.AI.Providers.Adding;

/// <summary>
/// Command for adding an OpenAI AI provider - a named API key against OpenAI's public API. Ported
/// from Direct's <c>AIProviders.Adding.AddOpenAIProvider</c> (plan Section 5.2 step 4) - deliberately
/// without Direct's own subscription-credential-kind classification event
/// (<c>OpenAICredentialKind.EventFor</c>), which belongs to the not-yet-ported Codex/harness
/// credential subsystem (plan Section 5.6). A ChatGPT subscription pasted here is still accepted -
/// see <see cref="OpenAI.OpenAICredential"/> - it is simply not yet separately recorded as its own
/// fact the way Direct's donor does.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="ApiKey">The OpenAI API key.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on it at once - zero for no limit.</param>
[Command]
public record AddOpenAIProvider(AIProviderName Name, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// Handles the command by opening a new provider stream and appending an
    /// <see cref="OpenAIProviderAdded"/> event, with the API key protected at rest.
    /// </summary>
    /// <param name="protector">The <see cref="ISecretProtector"/> the key is protected through.</param>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public async Task<(AIProviderId, OpenAIProviderAdded)> Handle(ISecretProtector protector) =>
        (AIProviderId.New(), new(Name, await protector.Protect(ApiKey), MaxConcurrentJobs));
}

/// <summary>
/// Represents the validator for the <see cref="AddOpenAIProvider"/> command.
/// </summary>
public class AddOpenAIProviderValidator : CommandValidator<AddOpenAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddOpenAIProviderValidator"/> class.
    /// </summary>
    public AddOpenAIProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.ApiKey).NotEqual(AIProviderApiKey.NotSet).WithMessage("An API key is required");
    }
}

/// <summary>
/// Event raised when an OpenAI AI provider has been added.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="ApiKey">The OpenAI API key, protected at rest.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on the provider at once - zero for no limit.</param>
[EventType]
public record OpenAIProviderAdded(AIProviderName Name, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs);
