// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.ChangingLabels;

/// <summary>
/// Command for changing the labels of an issue - mirroring labeling on GitHub. The full label set
/// travels as one fact; GitHub's labeled/unlabeled deliveries both carry the resulting set.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Labels">The labels the issue now has.</param>
[Command]
public record ChangeIssueLabels(IssueId Issue, IEnumerable<LabelName> Labels)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueLabelsChanged"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueLabelsChanged Handle() => new(Labels);
}

/// <summary>
/// Event raised when the labels of an issue have changed on GitHub - carries the full resulting set.
/// </summary>
/// <param name="Labels">The labels the issue now has.</param>
[EventType]
public record IssueLabelsChanged(IEnumerable<LabelName> Labels);
