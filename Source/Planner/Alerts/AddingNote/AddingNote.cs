// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Identity;

namespace Planner.Alerts.AddingNote;

/// <summary>
/// Command for recording what someone found out about an alert on the way to resolving it - the
/// detail that accumulates between an agent handing an alert over and a person closing it.
/// </summary>
/// <param name="Alert">The identity of the alert.</param>
/// <param name="Text">What to record.</param>
[Command]
public record AddAlertNote(AlertId Alert, AlertNote Text)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AlertNoteAdded"/> event to the alert's stream.
    /// </summary>
    /// <param name="currentUser">The <see cref="ICurrentUser"/> adding the note.</param>
    /// <returns>The event.</returns>
    public AlertNoteAdded Handle(ICurrentUser currentUser) => new(AlertNoteId.New(), Text, currentUser.GetUserName());
}

/// <summary>
/// Represents the validator for the <see cref="AddAlertNote"/> command.
/// </summary>
public class AddAlertNoteValidator : CommandValidator<AddAlertNote>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddAlertNoteValidator"/> class.
    /// </summary>
    public AddAlertNoteValidator() => RuleFor(_ => _.Text).NotEqual(AlertNote.NotSet).WithMessage("A note needs something in it");
}

/// <summary>
/// Event raised when a note has been recorded against an alert.
/// </summary>
/// <param name="Note">The identity of the note.</param>
/// <param name="Text">What was recorded.</param>
/// <param name="AddedBy">The login of the user that recorded it - <see cref="UserName.NotSet"/> for automation.</param>
[EventType]
public record AlertNoteAdded(AlertNoteId Note, AlertNote Text, UserName AddedBy);
