// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.Synchronization;

/// <summary>
/// Defines the cluster-wide grain that consolidates the mirrored issues with GitHub once a day,
/// catching anything a missed webhook would otherwise skip.
/// </summary>
public interface IGitHubSynchronizer : IGrainWithIntegerKey
{
    /// <summary>
    /// Ensures the daily consolidation reminder is registered - called at startup.
    /// </summary>
    /// <returns>Awaitable task.</returns>
    Task Ensure();

    /// <summary>
    /// Triggers an immediate full synchronization of every tracked repository.
    /// </summary>
    /// <returns>Awaitable task.</returns>
    Task SynchronizeNow();
}
