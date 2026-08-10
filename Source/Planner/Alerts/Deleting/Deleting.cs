// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts.Deleting;

/// <summary>
/// Command for taking an alert off the board entirely - for the noise a sending system should not
/// have reported in the first place. The alert's history stays in the event log; only the row goes.
/// </summary>
/// <param name="Alert">The identity of the alert.</param>
[Command]
public record DeleteAlert(AlertId Alert)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AlertDeleted"/> event to the alert's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public AlertDeleted Handle() => new();
}

/// <summary>
/// Event raised when an alert has been deleted.
/// </summary>
[EventType]
public record AlertDeleted;
