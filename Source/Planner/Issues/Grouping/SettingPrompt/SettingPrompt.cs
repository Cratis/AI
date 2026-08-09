// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Grouping.SettingPrompt;

/// <summary>
/// Command for setting the extra instructions that travel with a group when an agent works on it.
/// </summary>
/// <param name="Group">The identity of the group.</param>
/// <param name="Prompt">The instructions - an empty prompt clears them.</param>
[Command]
public record SetGroupPrompt(GroupId Group, WorkPrompt Prompt)
{
    /// <summary>
    /// Handles the command by appending a <see cref="GroupPromptSet"/> event to the group's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public GroupPromptSet Handle() => new(Prompt);
}

/// <summary>
/// Event raised when the extra instructions for a group have been set - they are appended to the
/// prompt the agent gets when working on the group.
/// </summary>
/// <param name="Prompt">The instructions - the not-set sentinel when cleared.</param>
[EventType]
public record GroupPromptSet(WorkPrompt Prompt);
