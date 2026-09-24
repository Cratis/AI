// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.Renaming;

/// <summary>
/// Command for renaming an AI provider pool.
/// </summary>
/// <param name="Pool">The pool to rename.</param>
/// <param name="Name">The new display name.</param>
[Command]
public record RenameAIProviderPool(AIProviderPoolId Pool, AIProviderPoolName Name)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderPoolRenamed"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AIProviderPoolRenamed Handle() => new(Name);
}

/// <summary>
/// Represents the validator for the <see cref="RenameAIProviderPool"/> command.
/// </summary>
public class RenameAIProviderPoolValidator : CommandValidator<RenameAIProviderPool>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RenameAIProviderPoolValidator"/> class.
    /// </summary>
    public RenameAIProviderPoolValidator() => RuleFor(_ => _.Name).NotEqual(AIProviderPoolName.NotSet).WithMessage("A name is required");
}

/// <summary>
/// Event raised when an AI provider pool has been renamed.
/// </summary>
/// <param name="Name">The new display name.</param>
[EventType]
public record AIProviderPoolRenamed(AIProviderPoolName Name);
