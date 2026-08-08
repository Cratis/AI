// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.SettingPrompt;

/// <summary>
/// Command for setting the extra instructions that travel with an issue when an agent works on it.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Prompt">The instructions - an empty prompt clears them.</param>
[Command]
public record SetIssuePrompt(IssueId Issue, WorkPrompt Prompt)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssuePromptSet"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssuePromptSet Handle() => new(Prompt);
}

/// <summary>
/// Event raised when the extra instructions for an issue have been set - they are appended to the
/// prompt the agent gets when working on the issue.
/// </summary>
/// <param name="Prompt">The instructions - the not-set sentinel when cleared.</param>
[EventType]
public record IssuePromptSet(WorkPrompt Prompt);
