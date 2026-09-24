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
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public (AIProviderId, OpenAIProviderAdded) Handle() =>
        (AIProviderId.New(), new(Name, ApiKey, MaxConcurrentJobs));
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
[EventType(EventTypeId)]
public record OpenAIProviderAdded(AIProviderName Name, AIProviderApiKey ApiKey, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - chosen once, here, and
    /// never changed (decision 0002). Deliberately <em>not</em> matching Direct's own
    /// `OpenAIProviderAdded` the way every other sibling in this PR matches its donor (decision
    /// 0008): Direct keeps its own OpenAI Add/Reconfigure commands for now - they raise a second,
    /// not-yet-ported credential-kind classification event this type does not - so the two remain
    /// genuinely different event types with a coincidentally identical name, and pinning the same id
    /// here would recreate the exact collision decision 0007 exists to prevent, not resolve it.
    /// </summary>
    public const string EventTypeId = "fad79302-e93b-4b14-87fb-bd786f8ae134";
}
