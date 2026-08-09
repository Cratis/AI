// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Scheduling;

/// <summary>
/// Defines the cluster-wide scheduler grain. Orleans' single-threaded grain execution serializes
/// scheduling passes, so capacity decisions never race - the neat option Orleans gives us here.
/// </summary>
public interface IWorkScheduler : IGrainWithIntegerKey
{
    /// <summary>
    /// Ensures the recurring scheduling reminder is registered - called at startup.
    /// </summary>
    /// <returns>Awaitable task.</returns>
    Task Ensure();

    /// <summary>
    /// Triggers an immediate scheduling pass - poked when work is scheduled or an issue becomes
    /// ready, so dispatching does not wait for the next reminder tick.
    /// </summary>
    /// <returns>Awaitable task.</returns>
    Task Poke();
}
