// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.ChangingBody;

/// <summary>
/// Command for changing the body of an issue - mirroring a body edit on GitHub.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Body">The new markdown body.</param>
[Command]
public record ChangeIssueBody(IssueId Issue, IssueBody Body)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueBodyChanged"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueBodyChanged Handle() => new(Body);
}

/// <summary>
/// Event raised when an issue's body has changed on GitHub.
/// </summary>
/// <param name="Body">The new markdown body.</param>
[EventType]
public record IssueBodyChanged(IssueBody Body);
