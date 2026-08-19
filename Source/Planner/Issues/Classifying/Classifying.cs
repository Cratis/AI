// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Classifying;

/// <summary>
/// Command for recording how triage classified an issue - executed by the triage reactor once a
/// language model has produced a structured verdict for a newly registered issue.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Kind">What kind of issue this is.</param>
/// <param name="Feasibility">Whether an agent can act on it.</param>
/// <param name="SuggestedPriority">The priority triage suggests - <see cref="Planner.Issues.Priority.NotSet"/> when it has no opinion.</param>
/// <param name="SuggestedLabels">Labels triage suggests from the repository's existing label vocabulary.</param>
/// <param name="Area">The affected area, in the project's own words (e.g. "Chronicle kernel").</param>
/// <param name="SuggestedModel">The model triage suggests for implementation.</param>
[Command]
public record ClassifyIssue(
    IssueId Issue,
    IssueKind Kind,
    IssueFeasibility Feasibility,
    Priority SuggestedPriority,
    IEnumerable<LabelName> SuggestedLabels,
    IssueArea Area,
    ModelName SuggestedModel)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueClassified"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueClassified Handle() => new(Kind, Feasibility, SuggestedPriority, SuggestedLabels, Area, SuggestedModel);
}

/// <summary>
/// Event raised when triage has classified an issue.
/// </summary>
/// <param name="Kind">What kind of issue this is.</param>
/// <param name="Feasibility">Whether an agent can act on it.</param>
/// <param name="SuggestedPriority">The priority triage suggests.</param>
/// <param name="SuggestedLabels">Labels triage suggests from the repository's existing label vocabulary.</param>
/// <param name="Area">The affected area, in the project's own words.</param>
/// <param name="SuggestedModel">The model triage suggests for implementation.</param>
[EventType]
public record IssueClassified(
    IssueKind Kind,
    IssueFeasibility Feasibility,
    Priority SuggestedPriority,
    IEnumerable<LabelName> SuggestedLabels,
    IssueArea Area,
    ModelName SuggestedModel);
