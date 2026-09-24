// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.Creating;

/// <summary>
/// Command for creating an AI provider pool - a named group of providers a role can draw from
/// instead of naming a single provider, so a burst of reasoning work spreads across several
/// accounts/vendors rather than burning one.
/// </summary>
/// <param name="Name">The pool's display name.</param>
[Command]
public record CreateAIProviderPool(AIProviderPoolName Name)
{
    /// <summary>
    /// Handles the command by opening a new pool stream and appending an <see cref="AIProviderPoolCreated"/> event.
    /// </summary>
    /// <returns>A tuple of the pool identity (event source) and the event.</returns>
    public (AIProviderPoolId, AIProviderPoolCreated) Handle() => (AIProviderPoolId.New(), new(Name));
}

/// <summary>
/// Represents the validator for the <see cref="CreateAIProviderPool"/> command.
/// </summary>
public class CreateAIProviderPoolValidator : CommandValidator<CreateAIProviderPool>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="CreateAIProviderPoolValidator"/> class.
    /// </summary>
    public CreateAIProviderPoolValidator() => RuleFor(_ => _.Name).NotEqual(AIProviderPoolName.NotSet).WithMessage("A name is required");
}

/// <summary>
/// Event raised when an AI provider pool has been created.
/// </summary>
/// <param name="Name">The pool's display name.</param>
[EventType]
public record AIProviderPoolCreated(AIProviderPoolName Name);
