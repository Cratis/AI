// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Workers;

/// <summary>
/// Defines the runtime that launches worker containers for agent sessions. Implementations bind to
/// the environment a consumer runs in: the local Docker daemon when running and testing locally,
/// Kubernetes in production. Ported from Direct's <c>Work.Workers.IWorkerRuntime</c> (plan Section
/// 5.6) - every doc comment here, including the incident dates, is preserved verbatim from Direct's
/// original as the plan instructs, with <c>WorkId</c> generalized to <see cref="AgentSessionId"/>.
/// </summary>
public interface IWorkerRuntime
{
    /// <summary>
    /// Launches a worker container for an agent session. The container runs to completion on its own
    /// and reports progress back through the callback URL in its environment.
    /// </summary>
    /// <param name="job">The worker job to launch.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task Start(WorkerJob job, CancellationToken cancellationToken = default);

    /// <summary>
    /// Whether the worker for an agent session is still alive.
    /// </summary>
    /// <remarks>
    /// A worker reports its own outcome, so work that is running has a container that intends to
    /// call back. When the container dies without reporting - an OOM kill, a node eviction, a crash
    /// - nothing ever arrives and the work sits running, holding a concurrency slot, until a duration
    /// sweep gives up on it hours later. Asking the runtime turns that from a guess based on elapsed
    /// time into an answer.
    /// <para>
    /// <see langword="null"/> means the runtime cannot tell - it could not be reached, or it has no
    /// record either way. That is deliberately distinct from <see langword="false"/>: "I do not
    /// know" must never be read as "it is dead", or a runtime hiccup would fail work that is
    /// perfectly healthy.
    /// </para>
    /// </remarks>
    /// <param name="session">The identity of the agent session whose worker to ask about.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns><see langword="true"/> when alive, <see langword="false"/> when gone, <see langword="null"/> when unknown.</returns>
    Task<bool?> IsAlive(AgentSessionId session, CancellationToken cancellationToken = default);

    /// <summary>
    /// Whether the worker for an agent session has actually started running, as distinct from merely
    /// having been asked for.
    /// </summary>
    /// <remarks>
    /// A worker can be stuck between "launched" and "running" for a long time without dying - a
    /// container stuck in <c>ContainerCreating</c> behind a mount that never completes is not dead,
    /// it never started, and every other signal this runtime exposes reads the same for both. On
    /// 2026-09-02 an unreachable NFS export left six worker pods that way for up to 92 minutes, with
    /// nothing distinguishing them from pods about to start normally.
    /// <para>
    /// <see langword="false"/> means confirmed not started yet (still <c>Pending</c>).
    /// <see langword="true"/> means it has, or the runtime has no comparable "still creating" phase to
    /// report (a local Docker container, for instance). <see langword="null"/> means the runtime
    /// cannot tell - never treated as "not started", for the same reason <see cref="IsAlive"/>'s
    /// <see langword="null"/> is never treated as "dead".
    /// </para>
    /// </remarks>
    /// <param name="session">The identity of the agent session whose worker to ask about.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns><see langword="true"/> when started, <see langword="false"/> when confirmed not yet, <see langword="null"/> when unknown.</returns>
    Task<bool?> HasStarted(AgentSessionId session, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stops and removes the worker for an agent session. Best effort - a worker that already
    /// finished or was cleaned up is not an error.
    /// </summary>
    /// <param name="session">The identity of the agent session whose worker to stop.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task Stop(AgentSessionId session, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes every trace of an agent session's worker, including one the runtime cannot shut down
    /// cleanly, so the name it holds is free for the next attempt.
    /// </summary>
    /// <remarks>
    /// <see cref="Stop"/> asks politely and accepts "not yet" - which is right while the worker is
    /// alive and might still push what it committed. This does not: it is for a worker that is not
    /// coming back, and whose leftovers are the only thing standing between the work and its next
    /// dispatch.
    /// <para>
    /// The distinction is not academic. A worker name is derived from the session id and a resumed
    /// session keeps its id, so leftovers block every re-dispatch. On 2026-09-01 a node stopped
    /// reporting with fourteen worker pods on it: Kubernetes cannot confirm a pod on an unreachable
    /// node is gone, the foreground deletion of each Job waited for exactly that confirmation, and
    /// every dispatch for hours answered <c>409 object is being deleted</c>. Nothing in the system
    /// could ever have cleared it - the work stayed queued until somebody deleted the pods by hand.
    /// </para>
    /// </remarks>
    /// <param name="session">The identity of the agent session whose worker to remove.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task Purge(AgentSessionId session, CancellationToken cancellationToken = default);

    /// <summary>
    /// Streams the console output of the worker for an agent session, line by line, following the
    /// log while the worker runs.
    /// </summary>
    /// <param name="session">The identity of the agent session whose worker log to stream.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> that ends the stream.</param>
    /// <returns>An async stream of log lines.</returns>
    IAsyncEnumerable<string> StreamLogs(AgentSessionId session, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a line of text to the worker's standard input - the entrypoint forwards it to the
    /// running harness session as a steering message.
    /// </summary>
    /// <param name="session">The identity of the agent session whose worker to steer.</param>
    /// <param name="text">The text to send.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task SendInput(AgentSessionId session, string text, CancellationToken cancellationToken = default);
}
