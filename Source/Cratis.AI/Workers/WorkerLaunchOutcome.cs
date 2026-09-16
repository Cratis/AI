// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// What happened when <see cref="IWorkerRuntime.Start"/> was asked to launch a worker - every
/// outcome a caller is expected to branch on as ordinary application logic, not to discover by
/// catching an exception. See <c>.cratis/ai/rules/csharp.md</c>'s "Exceptions" section: none of
/// these are unrecoverable - a caller records a different impediment for each and leaves the work
/// scheduled for the next pass, which is exactly the kind of anticipated, recoverable branching that
/// belongs in a return type rather than a throw list.
/// </summary>
public enum WorkerLaunchOutcome
{
    /// <summary>
    /// The worker launched successfully.
    /// </summary>
    Started,

    /// <summary>
    /// The previous worker for this session is still alive and actually running - deleting it to
    /// make room for a new one would destroy a container that is genuinely doing the work
    /// (Cratis/Stagehand#500). Not launched; the caller should leave the work scheduled without
    /// touching the running worker.
    /// </summary>
    AlreadyRunning,

    /// <summary>
    /// The previous worker for this session has not finished terminating yet, so its name is still
    /// taken. Not launched; the caller should leave the work scheduled and try again on the next
    /// pass, once the cluster has finished cleaning up.
    /// </summary>
    StillGoingAway,

    /// <summary>
    /// The launch failed for a reason that is about the cluster rather than about the work - a
    /// transient API failure, an expired credential on the calling process's own pod. Not launched;
    /// the caller should leave the work scheduled and try again, the same as
    /// <see cref="StillGoingAway"/>.
    /// </summary>
    RefusedByCluster
}
