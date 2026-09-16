// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;

namespace Cratis.AI.Providers.Adding;

/// <summary>
/// Command for adding a Z.ai AI provider - a GLM account reached through Z.ai's Anthropic-compatible
/// API at a configurable endpoint. Ported from Direct's <c>AIProviders.Adding.AddZAIProvider</c>
/// (plan Section 5.2 step 4).
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="Endpoint">The Z.ai endpoint - the base URL the Anthropic-compatible API sits under.</param>
/// <param name="ApiKey">The Z.ai API key.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on it at once - zero for no limit.</param>
[Command]
public record AddZAIProvider(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// Handles the command by opening a new provider stream and appending a
    /// <see cref="ZAIProviderAdded"/> event, with the API key protected at rest.
    /// </summary>
    /// <param name="protector">The <see cref="ISecretProtector"/> the key is protected through.</param>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public async Task<(AIProviderId, ZAIProviderAdded)> Handle(ISecretProtector protector) =>
        (AIProviderId.New(), new(Name, Endpoint, await protector.Protect(ApiKey), MaxConcurrentJobs));
}

/// <summary>
/// Represents the validator for the <see cref="AddZAIProvider"/> command.
/// </summary>
public class AddZAIProviderValidator : CommandValidator<AddZAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddZAIProviderValidator"/> class.
    /// </summary>
    public AddZAIProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.Endpoint).NotEqual(AIProviderEndpoint.NotSet).WithMessage("An endpoint is required");
        RuleFor(_ => _.ApiKey).NotEqual(AIProviderApiKey.NotSet).WithMessage("An API key is required");
    }
}

/// <summary>
/// Event raised when a Z.ai AI provider has been added.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="Endpoint">The Z.ai endpoint - the base URL the Anthropic-compatible API sits under.</param>
/// <param name="ApiKey">The Z.ai API key, protected at rest.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on the provider at once - zero for no limit.</param>
[EventType(EventTypeId)]
public record ZAIProviderAdded(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - chosen once, here, and
    /// never changed (decision 0002). Deliberately the bare type name as a string, not a fresh guid:
    /// this is exactly the id Direct's own pre-migration same-named type already resolves to
    /// implicitly (Chronicle's own type-name fallback, decision 0007) - matching it keeps Direct's
    /// real, already-stored provider events readable through this type once Direct's own duplicate
    /// is deleted, rather than orphaning them under an id nothing produces anymore.
    /// </summary>
    public const string EventTypeId = "ZAIProviderAdded";
}
