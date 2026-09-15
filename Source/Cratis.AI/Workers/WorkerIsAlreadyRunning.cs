// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Workers;

/// <summary>
/// The exception that is thrown when a worker cannot be launched because the previous worker for the
/// same agent session is still alive and actually running. Ported from Direct's
/// <c>Work.Workers.WorkerIsAlreadyRunning</c> (plan Section 5.6), <c>WorkId</c> generalized to
/// <see cref="AgentSessionId"/>.
/// </summary>
/// <remarks>
/// A worker's Kubernetes Job and Secret are named after the session id, and a resumed session keeps
/// its id - which is what makes a re-dispatch safe to collide with, and replace, a genuinely dead
/// attempt's leftovers (see <see cref="WorkerIsStillGoingAway"/> for the "still terminating" half of
/// that story). It stops being safe the moment the "previous attempt" is not a leftover at all: a
/// session re-entering the dispatch queue while its worker is still running - a refused
/// acknowledgement after a successful launch, a stale read, an operator retry - would otherwise have
/// its live container deleted out from under it, and a second one started on the same branch
/// (Cratis/Stagehand#500).
/// <para>
/// Like <see cref="WorkerIsStillGoingAway"/>, this is a "not now" rather than a failure - the worker is
/// doing exactly what it should, so the scheduler records it as an impediment and leaves the work
/// alone rather than touching it.
/// </para>
/// </remarks>
/// <param name="session">The agent session whose worker is already running.</param>
public class WorkerIsAlreadyRunning(AgentSessionId session)
    : Exception($"A worker for session {session} is already running, so a new one was refused rather than destroying it");
