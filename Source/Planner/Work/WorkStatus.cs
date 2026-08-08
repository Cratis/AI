// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work;

/// <summary>
/// The lifecycle status of a unit of agent work.
/// </summary>
public enum WorkStatus
{
    /// <summary>The work is scheduled and waiting for capacity - the initial state.</summary>
    Scheduled = 0,

    /// <summary>A worker container is running the work.</summary>
    Running = 1,

    /// <summary>The work finished successfully.</summary>
    Completed = 2,

    /// <summary>The work failed.</summary>
    Failed = 3,

    /// <summary>The work was stopped deliberately before it finished.</summary>
    Stopped = 4
}
