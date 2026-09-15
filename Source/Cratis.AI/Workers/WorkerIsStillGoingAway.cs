// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Workers;

/// <summary>
/// The exception that is thrown when a worker cannot be started because the previous worker for the
/// same agent session has not finished going away yet. Ported from Direct's
/// <c>Work.Workers.WorkerIsStillGoingAway</c> (plan Section 5.6), <c>WorkId</c> generalized to
/// <see cref="AgentSessionId"/>.
/// </summary>
/// <remarks>
/// A worker's Kubernetes Job is named after the session it runs, so a session has exactly one Job
/// name for its whole life. That is what makes a dispatch idempotent - and it also means a dispatch
/// arriving while the previous Job is still terminating is refused with a 409, because the name is
/// taken by an object that is on its way out.
/// <para>
/// This is a "not yet", not a failure. It says nothing about whether the work can run - only that
/// the cluster has not finished cleaning up from the last attempt. Distinguished from a genuine
/// launch failure so the scheduler can leave the work scheduled and try again on the next pass,
/// rather than marking it failed and dropping it out of the only view that would have shown it.
/// </para>
/// </remarks>
/// <param name="session">The agent session whose worker could not be started yet.</param>
/// <param name="inner">The refusal from the cluster.</param>
public class WorkerIsStillGoingAway(AgentSessionId session, Exception inner)
    : Exception($"The previous worker for session {session} is still terminating, so a new one cannot take its name yet", inner);
