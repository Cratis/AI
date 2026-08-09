// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Hosting;

/// <summary>
/// Represents how the co-hosted silo discovers its cluster and where it keeps its reminders.
/// </summary>
public enum ClusteringMode
{
    /// <summary>
    /// A single silo on localhost with in-memory reminders - for local development.
    /// </summary>
    Localhost = 0,

    /// <summary>
    /// MongoDB backed membership and reminders - for running more than one instance, and for
    /// reminders that survive a restart.
    /// </summary>
    MongoDB = 1
}
