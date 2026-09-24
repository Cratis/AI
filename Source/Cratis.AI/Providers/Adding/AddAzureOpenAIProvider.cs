// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;

namespace Cratis.AI.Providers.Adding;

/// <summary>
/// Command for adding an Azure OpenAI AI provider - a named deployment at a tenant-specific
/// endpoint. Ported from Direct's <c>AIProviders.Adding.AddAzureOpenAIProvider</c> (plan Section 5.2
/// step 4).
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="Endpoint">The Azure OpenAI resource endpoint.</param>
/// <param name="ApiKey">The Azure OpenAI API key.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on it at once - zero for no limit.</param>
[Command]
public record AddAzureOpenAIProvider(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// Handles the command by opening a new provider stream and appending an
    /// <see cref="AzureOpenAIProviderAdded"/> event, with the API key protected at rest.
    /// </summary>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public (AIProviderId, AzureOpenAIProviderAdded) Handle() =>
        (AIProviderId.New(), new(Name, Endpoint, ApiKey, MaxConcurrentJobs));
}

/// <summary>
/// Represents the validator for the <see cref="AddAzureOpenAIProvider"/> command.
/// </summary>
public class AddAzureOpenAIProviderValidator : CommandValidator<AddAzureOpenAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddAzureOpenAIProviderValidator"/> class.
    /// </summary>
    public AddAzureOpenAIProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.Endpoint).NotEqual(AIProviderEndpoint.NotSet).WithMessage("An endpoint is required");
        RuleFor(_ => _.ApiKey).NotEqual(AIProviderApiKey.NotSet).WithMessage("An API key is required");
    }
}

/// <summary>
/// Event raised when an Azure OpenAI AI provider has been added.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="Endpoint">The Azure OpenAI resource endpoint.</param>
/// <param name="ApiKey">The Azure OpenAI API key, protected at rest.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on the provider at once - zero for no limit.</param>
[EventType]
public record AzureOpenAIProviderAdded(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs);
