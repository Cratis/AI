// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Renaming;

/// <summary>
/// Command for renaming an issue - mirroring a title edit on GitHub.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Title">The new title.</param>
[Command]
public record RenameIssue(IssueId Issue, IssueTitle Title)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueRenamed"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueRenamed Handle() => new(Title);
}

/// <summary>
/// Represents the validator for the <see cref="RenameIssue"/> command.
/// </summary>
public class RenameIssueValidator : CommandValidator<RenameIssue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RenameIssueValidator"/> class.
    /// </summary>
    public RenameIssueValidator() => RuleFor(_ => _.Title).NotEmpty().WithMessage("A title is required");
}

/// <summary>
/// Event raised when an issue's title has changed on GitHub.
/// </summary>
/// <param name="Title">The new title.</param>
[EventType]
public record IssueRenamed(IssueTitle Title);
