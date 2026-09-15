// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Renaming;

/// <summary>
/// Command for renaming a configured AI provider - vendor-agnostic, since a name change touches
/// nothing vendor-specific. Ported from Direct's <c>AIProviders.Renaming.RenameAIProvider</c> (plan
/// Section 5.2 step 4).
/// </summary>
/// <param name="Provider">The provider to rename.</param>
/// <param name="Name">The new display name.</param>
[Command]
public record RenameAIProvider(AIProviderId Provider, AIProviderName Name)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderRenamed"/> event.
    /// </summary>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public (AIProviderId, AIProviderRenamed) Handle() => (Provider, new(Name));
}

/// <summary>
/// Represents the validator for the <see cref="RenameAIProvider"/> command.
/// </summary>
public class RenameAIProviderValidator : CommandValidator<RenameAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RenameAIProviderValidator"/> class.
    /// </summary>
    public RenameAIProviderValidator() => RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
}

/// <summary>
/// Event raised when a configured AI provider has been renamed.
/// </summary>
/// <param name="Name">The new display name.</param>
[EventType(EventTypeId)]
public record AIProviderRenamed(AIProviderName Name)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type. Chosen once, here, and
    /// never changed - see decision 0002.
    /// </summary>
    public const string EventTypeId = "b00a5f7a-61de-43c5-a201-5209c68f02b3";
}
