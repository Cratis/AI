// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Configuring;

/// <summary>
/// Command for renaming a configured AI provider without touching its credentials - vendor-agnostic.
/// Ported from Studio's own <c>Settings.AI.Providers.Renaming.RenameAIProvider</c>. Distinct from
/// <see cref="Renaming.RenameAIProvider"/> (Direct's shape, <c>Provider</c> rather than <c>Id</c>,
/// <see cref="Renaming.AIProviderRenamed"/> rather than <see cref="AIModelRenamed"/>) for the same
/// reason the vendor Add/Reconfigure commands in this namespace are - see
/// <see cref="AnthropicModelConfigured"/>'s remarks.
/// </summary>
/// <param name="Id">The identifier of the provider to rename.</param>
/// <param name="Name">The new name.</param>
[Command]
public record RenameAIProvider(AIProviderId Id, AIProviderName Name)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIModelRenamed"/> event.
    /// </summary>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public (AIProviderId, AIModelRenamed) Handle() => (Id, new(Name));
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
/// Event raised when a configured AI provider has been given a new name. Ported from Studio's own
/// <c>Settings.AI.Providers.Renaming.AIModelRenamed</c>.
/// </summary>
/// <param name="Name">The new name the organization knows the provider by.</param>
[EventType]
public record AIModelRenamed(AIProviderName Name);
