// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Grouping.Creating;

/// <summary>
/// Command for creating a group of issues - typically by dropping one issue onto another. The
/// issues in a group are scheduled together: work starts only when every issue in the group is
/// ready for development.
/// </summary>
/// <param name="Name">The display name of the group.</param>
/// <param name="Issues">The identities of the issues forming the group.</param>
[Command]
public record CreateGroup(GroupName Name, IEnumerable<IssueId> Issues)
{
    /// <summary>
    /// Handles the command by opening a new group stream and adding each issue to the group.
    /// </summary>
    /// <returns>The <see cref="GroupCreated"/> event and an <see cref="IssueAddedToGroup"/> per issue.</returns>
    public IEnumerable<EventForEventSourceId> Handle()
    {
        var groupId = GroupId.New();
        yield return new EventForEventSourceId(groupId, new GroupCreated(Name));
        foreach (var issue in Issues)
        {
            yield return new EventForEventSourceId(issue, new IssueAddedToGroup(groupId));
        }
    }
}

/// <summary>
/// Represents the validator for the <see cref="CreateGroup"/> command.
/// </summary>
public class CreateGroupValidator : CommandValidator<CreateGroup>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="CreateGroupValidator"/> class.
    /// </summary>
    public CreateGroupValidator()
    {
        RuleFor(_ => _.Name).NotEmpty().WithMessage("A group name is required");
        RuleFor(_ => _.Issues).NotEmpty().WithMessage("A group needs at least one issue");
    }
}

/// <summary>
/// Event raised when a group of issues has been created.
/// </summary>
/// <param name="Name">The display name of the group.</param>
[EventType]
public record GroupCreated(GroupName Name);

/// <summary>
/// Event raised when an issue has been added to a group - appended to the issue's own stream.
/// </summary>
/// <param name="Group">The identity of the group the issue was added to.</param>
[EventType]
public record IssueAddedToGroup(GroupId Group);
