// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues;

/// <summary>
/// How urgently an issue should be worked on. Ordered so a numeric comparison sorts the most
/// urgent first - <see cref="NotSet"/> sorts last, behind every explicit priority.
/// </summary>
public enum Priority
{
    /// <summary>No priority has been set - the lowest in sort order, not "low priority" itself.</summary>
    NotSet = 0,

    /// <summary>Low priority - worth doing, no urgency.</summary>
    Low = 1,

    /// <summary>Normal priority - the default weight once a priority is set at all.</summary>
    Normal = 2,

    /// <summary>High priority - should be picked up ahead of normal work.</summary>
    High = 3,

    /// <summary>Critical priority - should be picked up next, ahead of everything else.</summary>
    Critical = 4
}
