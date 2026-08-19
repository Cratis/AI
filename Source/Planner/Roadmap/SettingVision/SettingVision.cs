// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Roadmap.SettingVision;

/// <summary>
/// Command for setting the Planner's vision document - where the team is going, maintained by hand
/// and given to agents as context. One setting shared across the whole deployment; every change is
/// its own event, so the vision has history.
/// </summary>
/// <param name="Content">The markdown content of the vision.</param>
[Command]
public record SetVision(VisionContent Content) : ICanProvideEventSourceId
{
    /// <summary>
    /// Gets the fixed event source id - there is exactly one vision document per deployment.
    /// </summary>
    /// <returns>The fixed event source id.</returns>
    public EventSourceId GetEventSourceId() => VisionId.Default;

    /// <summary>
    /// Handles the command by appending a <see cref="VisionSet"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public VisionSet Handle() => new(Content);
}

/// <summary>
/// Event raised when the Planner's vision document has been set.
/// </summary>
/// <param name="Content">The markdown content of the vision.</param>
[EventType]
public record VisionSet(VisionContent Content);
