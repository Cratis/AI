// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Roadmap.SettingVision;

namespace Planner.Roadmap.Listing;

/// <summary>
/// Read model for the Planner's vision document.
/// </summary>
/// <param name="Id">The vision identity - always <see cref="VisionId.Default"/>.</param>
/// <param name="Content">The markdown content of the vision.</param>
/// <param name="UpdatedAt">When the vision was last set.</param>
[ReadModel]
[FromEvent<VisionSet>]
public record Vision(
    VisionId Id,
    VisionContent Content,
    [SetFromContext<VisionSet>(nameof(EventContext.Occurred))]
    DateTimeOffset? UpdatedAt = null)
{
    /// <summary>
    /// Gets the current vision - a default-initialized instance (empty <see cref="Content"/>) until
    /// one has been set.
    /// </summary>
    /// <param name="readModels">The <see cref="IReadModels"/> to read from.</param>
    /// <returns>The vision.</returns>
    public static Task<Vision> Current(IReadModels readModels) =>
        readModels.GetInstanceById<Vision>((EventSourceId)VisionId.Default);
}
