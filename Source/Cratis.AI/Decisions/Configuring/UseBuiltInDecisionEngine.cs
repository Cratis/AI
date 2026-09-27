// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Monads;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Decisions.Configuring;

/// <summary>
/// Command for making decisions through the platform's own built-in Decision Engine.
/// </summary>
/// <remarks>
/// Carries nothing. Where the built-in engine lives is deployment configuration
/// (<see cref="BuiltInDecisionEngineOptions"/>), so choosing it is a choice and nothing more.
/// </remarks>
[Command]
public record UseBuiltInDecisionEngine : ICanProvideEventSourceId
{
    /// <summary>
    /// Gets the one identity the decision engine configuration is recorded under.
    /// </summary>
    /// <returns>The event source id.</returns>
    public EventSourceId GetEventSourceId() => DecisionEngineId.Default;

    /// <summary>
    /// Handles the command by appending a <see cref="BuiltInDecisionEngineSelected"/> event.
    /// </summary>
    /// <param name="builtIn">Where the built-in engine lives, when this deployment has one.</param>
    /// <returns>The event, or a validation error when this deployment has no built-in engine.</returns>
    /// <remarks>
    /// Refused rather than recorded when the deployment has no built-in engine: a selection that
    /// can never be served would leave every decision failing while the settings read as fine.
    /// </remarks>
    public Result<BuiltInDecisionEngineSelected, ValidationResult> Handle(IOptions<BuiltInDecisionEngineOptions> builtIn) =>
        builtIn.Value.IsAvailable
            ? new BuiltInDecisionEngineSelected()
            : ValidationResult.Error("This deployment has no built-in decision engine");
}

/// <summary>
/// Event raised when the built-in Decision Engine has been chosen to make decisions through.
/// </summary>
[EventType]
public record BuiltInDecisionEngineSelected;
