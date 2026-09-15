// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;

namespace Cratis.AI.Providers.Adding;

/// <summary>
/// Command for adding an Anthropic AI provider - a named API key, callable from any agent that
/// picks it. Ported from Direct's <c>AIProviders.Adding.AddAnthropicProvider</c> (plan Section 5.2
/// step 4), rewired onto the package's own <see cref="ISecretProtector"/> in place of Direct's
/// tenant-scoped <c>ISecurityTokenProtector</c>.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="ApiKey">The Anthropic API key.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on it at once - zero for no limit.</param>
[Command]
public record AddAnthropicProvider(AIProviderName Name, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// Handles the command by opening a new provider stream and appending an
    /// <see cref="AnthropicProviderAdded"/> event, with the API key protected at rest.
    /// </summary>
    /// <param name="protector">The <see cref="ISecretProtector"/> the key is protected through.</param>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public async Task<(AIProviderId, AnthropicProviderAdded)> Handle(ISecretProtector protector) =>
        (AIProviderId.New(), new(Name, await protector.Protect(ApiKey), MaxConcurrentJobs));
}

/// <summary>
/// Represents the validator for the <see cref="AddAnthropicProvider"/> command.
/// </summary>
public class AddAnthropicProviderValidator : CommandValidator<AddAnthropicProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddAnthropicProviderValidator"/> class.
    /// </summary>
    public AddAnthropicProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.ApiKey).NotEqual(AIProviderApiKey.NotSet).WithMessage("An API key is required");
    }
}

/// <summary>
/// Event raised when an Anthropic AI provider has been added.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="ApiKey">The Anthropic API key, protected at rest.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on the provider at once - zero for no limit.</param>
[EventType(EventTypeId)]
public record AnthropicProviderAdded(AIProviderName Name, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - chosen once, here, and
    /// never changed (decision 0002). Deliberately the bare type name as a string, not a fresh guid:
    /// this is exactly the id Direct's own pre-migration same-named type already resolves to
    /// implicitly (Chronicle's own type-name fallback, decision 0007) - matching it keeps Direct's
    /// real, already-stored provider events readable through this type once Direct's own duplicate
    /// is deleted, rather than orphaning them under an id nothing produces anymore.
    /// </summary>
    public const string EventTypeId = "AnthropicProviderAdded";
}
