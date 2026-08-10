// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Identity;

namespace Planner.Alerts.Resolving;

/// <summary>
/// Command for closing an alert a person dealt with - the counterpart to an agent resolving one
/// itself.
/// </summary>
/// <param name="Alert">The identity of the alert.</param>
/// <param name="Resolution">How it was resolved.</param>
[Command]
public record ResolveAlert(AlertId Alert, AlertNote Resolution)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AlertResolved"/> event to the alert's stream.
    /// </summary>
    /// <param name="currentUser">The <see cref="ICurrentUser"/> resolving the alert.</param>
    /// <returns>The event.</returns>
    public AlertResolved Handle(ICurrentUser currentUser) => new(Resolution, currentUser.GetUserName());
}

/// <summary>
/// Represents the validator for the <see cref="ResolveAlert"/> command.
/// </summary>
public class ResolveAlertValidator : CommandValidator<ResolveAlert>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ResolveAlertValidator"/> class.
    /// </summary>
    public ResolveAlertValidator() =>
        RuleFor(_ => _.Resolution).NotEqual(AlertNote.NotSet).WithMessage("Say how the alert was resolved");
}

/// <summary>
/// Event raised when a person resolved an alert.
/// </summary>
/// <param name="Resolution">How it was resolved.</param>
/// <param name="ResolvedBy">The login of the user that resolved it.</param>
[EventType]
public record AlertResolved(AlertNote Resolution, UserName ResolvedBy);
