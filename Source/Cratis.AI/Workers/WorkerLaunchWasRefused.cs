// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.Usage;
using k8s.Autorest;

namespace Cratis.AI.Workers;

/// <summary>
/// The exception that is thrown when a worker could not be launched for a reason that is about the
/// cluster rather than about the work. Ported from Direct's
/// <c>Work.Workers.WorkerLaunchWasRefused</c> (plan Section 5.6), <c>WorkId</c> generalized to
/// <see cref="AgentSessionId"/>.
/// </summary>
/// <remarks>
/// Like <see cref="WorkerIsStillGoingAway"/>, this is a "not now" rather than a failure - the work is
/// perfectly runnable and the next pass should try again, so the scheduler records it as an
/// impediment and leaves the work scheduled.
/// <para>
/// The case that made this necessary: a pod's service account token is bound to the pod, so the
/// moment the consuming product's own pod is deleted - an ordinary deploy, or a restart after a
/// failed liveness probe - every request it still has in flight to the Kubernetes API comes back
/// 401. On 2026-09-01 that landed in the middle of a dispatch pass and failed twenty-two units of
/// work covering twenty-seven issues, all of which then lost their status and dropped off the board
/// entirely. Nothing was wrong with any of them.
/// </para>
/// </remarks>
/// <param name="session">The agent session whose worker could not be launched.</param>
/// <param name="inner">What the cluster said.</param>
public class WorkerLaunchWasRefused(AgentSessionId session, Exception inner)
    : Exception($"The cluster refused to launch a worker for session {session} - this is about the cluster rather than the work, so it stays scheduled", inner)
{
    /// <summary>
    /// Whether a failed launch says something about the cluster rather than about the work.
    /// </summary>
    /// <param name="exception">The exception the launch failed with.</param>
    /// <returns><see langword="true"/> when the work should stay scheduled and be tried again.</returns>
    /// <remarks>
    /// Deliberately narrow: a rejection the work itself caused - a Job specification the API server
    /// will not accept whatever happens - must still fail the work, or it retries forever and the
    /// reason never surfaces anywhere a person looks. Everything listed here resolves on its own or
    /// with a configuration change somewhere else, and none of it is a statement about the work.
    /// </remarks>
    public static bool IsAboutTheCluster(Exception exception) => exception switch
    {
        HttpOperationException http => http.Response?.StatusCode is
            HttpStatusCode.Unauthorized or
            HttpStatusCode.Forbidden or
            HttpStatusCode.RequestTimeout or
            HttpStatusCode.TooManyRequests or
            HttpStatusCode.InternalServerError or
            HttpStatusCode.BadGateway or
            HttpStatusCode.ServiceUnavailable or
            HttpStatusCode.GatewayTimeout,
        HttpRequestException => true,
        TaskCanceledException => true,
        _ => false
    };
}
