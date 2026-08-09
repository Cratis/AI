// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.ChangingStatus;

/// <summary>
/// Command for changing the Planner's internal status of an issue. One command serves the UI and
/// the orchestration; the log records a precise fact per transition.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Status">The status to change to.</param>
[Command]
public record ChangeIssueStatus(IssueId Issue, IssueStatus Status)
{
    /// <summary>
    /// Handles the command by appending the transition's fact to the issue's stream.
    /// </summary>
    /// <returns>The event matching the requested status.</returns>
    public IEnumerable<object> Handle()
    {
        yield return Status switch
        {
            IssueStatus.ReadyForDevelopment => new IssueMarkedReadyForDevelopment(),
            IssueStatus.InProgress => new IssueDevelopmentStarted(),
            IssueStatus.ForReview => new IssueMarkedForReview(),
            _ => new IssueStatusCleared()
        };
    }
}

/// <summary>
/// Event raised when an issue has been marked ready for development - the scheduler may pick it up
/// as soon as there is capacity (and, for grouped issues, the whole group is ready).
/// </summary>
[EventType]
public record IssueMarkedReadyForDevelopment;

/// <summary>
/// Event raised when development of an issue has started - an agent is working on it.
/// </summary>
[EventType]
public record IssueDevelopmentStarted;

/// <summary>
/// Event raised when an issue has been marked for review - the work is done and a pull request
/// awaits a human decision.
/// </summary>
[EventType]
public record IssueMarkedForReview;

/// <summary>
/// Event raised when an issue's internal status has been cleared back to none.
/// </summary>
[EventType]
public record IssueStatusCleared;
