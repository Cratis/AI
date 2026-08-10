// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Hosting;

/// <summary>
/// Represents how the co-hosted silo discovers its cluster.
/// </summary>
/// <remarks>
/// The mode picks the membership provider only. Reminders are always kept by Orleans' in-memory
/// reminder service, in both modes - see <see cref="OrleansConfigurationExtensions.AddPlannerOrleans"/>
/// for why the MongoDB reminder table is not an option.
/// </remarks>
public enum ClusteringMode
{
    /// <summary>
    /// A single silo on localhost - for local development.
    /// </summary>
    Localhost = 0,

    /// <summary>
    /// MongoDB backed cluster membership - for running more than one instance.
    /// </summary>
    MongoDB = 1
}
