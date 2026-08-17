// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Identity;
using Planner.Work.Authorizing;
using Planner.Work.Completing;
using Planner.Work.CompletingInvestigation;
using Planner.Work.Failing;
using Planner.Work.Listing;
using Planner.Work.Workers;

namespace Planner.Work.Callback;

/// <summary>
/// The payload a worker container posts back to the Planner.
/// </summary>
/// <param name="Status">The reported status: <c>started</c>, <c>completed</c> or <c>failed</c>.</param>
/// <param name="Detail">The result or failure detail the worker reported.</param>
/// <param name="InputTokens">The input tokens the session consumed, when reported.</param>
/// <param name="OutputTokens">The output tokens the session produced, when reported.</param>
/// <param name="CostUsd">The cost of the session in USD, when reported.</param>
/// <param name="DurationMs">How long the session ran in milliseconds, when reported.</param>
public record WorkerCallbackPayload(
    string Status,
    string Detail,
    long InputTokens = 0,
    long OutputTokens = 0,
    decimal CostUsd = 0,
    long DurationMs = 0);

/// <summary>
/// A line of steering text to forward to a running worker's Claude session.
/// </summary>
/// <param name="Text">The text to send.</param>
public record WorkerInputPayload(string Text);

/// <summary>
/// The transport boundary worker containers report progress through, and the live console log
/// stream. These are deliberately not Arc commands/queries - the callers are external processes
/// with free-form payloads and a server-sent event stream.
/// </summary>
/// <remarks>
/// Two different callers reach these three endpoints, so they are authenticated two different ways.
/// <para>
/// <c>POST /callback</c> is called by the worker container and by nothing else. It authenticates with
/// the per-work bearer token issued when the work was dispatched (see <see cref="IWorkTokens"/>), which
/// is the only credential that can prove a report came from the container the Planner launched. An
/// operator session deliberately does <b>not</b> open this endpoint: nobody should be able to declare
/// a unit of work finished, name its pull request and book its cost by hand.
/// </para>
/// <para>
/// <c>POST /input</c> and <c>GET /log</c> are called by the browser and by nothing else - steering the
/// running session and tailing its console. They authenticate as an operator, through the identity the
/// authenticating proxy put on the request (see <see cref="ProxyIdentity"/>). The worker token
/// deliberately does <b>not</b> open these: a container has no business steering itself, and the
/// console stream carries whatever the agent printed, credentials included.
/// </para>
/// </remarks>
public static class WorkerCallbackEndpoints
{
    /// <summary>
    /// Maps the worker callback and log-stream endpoints.
    /// </summary>
    /// <param name="app">The <see cref="WebApplication"/> to map on.</param>
    /// <returns>The same <see cref="WebApplication"/> for chaining.</returns>
    public static WebApplication MapWorkerCallbacks(this WebApplication app)
    {
        app.MapPost("/api/work/{workId}/callback", async (
            string workId,
            WorkerCallbackPayload payload,
            HttpRequest request,
            IEventStore eventStore,
            IWorkTokens workTokens,
            ICommandPipeline commandPipeline) =>
        {
            if (!Guid.TryParse(workId, out var parsedWorkId))
            {
                return Results.BadRequest("Invalid work id");
            }

            WorkId id = parsedWorkId;

            // Before anything is read or reported: prove the caller is the container this work was
            // dispatched to. Verified ahead of the work lookup so a wrong token and an unknown work
            // id are indistinguishable to a caller probing for valid ids.
            if (!await workTokens.IsValid(id, BearerToken.From(request)))
            {
                return Results.Unauthorized();
            }

            var work = await eventStore.ReadModels.GetInstanceById<WorkItem>((EventSourceId)id);
            if (work is null)
            {
                return Results.NotFound();
            }

            switch (payload.Status)
            {
                case "started":
                    // The dispatch already recorded the start through the StartWork command.
                    break;

                case "completed" when work.Purpose == WorkPurpose.Investigation:
                    var suggestedModel = WorkerResults.TryFindSuggestedModel(payload.Detail) ?? new ModelName("opus");
                    await commandPipeline.Execute(new CompleteInvestigation(
                        id,
                        payload.Detail,
                        suggestedModel,
                        payload.InputTokens,
                        payload.OutputTokens,
                        payload.CostUsd,
                        payload.DurationMs));
                    break;

                case "completed":
                    var pullRequest = WorkerResults.TryFindPullRequest(payload.Detail);
                    await commandPipeline.Execute(new CompleteWork(
                        id,
                        payload.Detail,
                        pullRequest?.Number,
                        pullRequest?.Url,
                        pullRequest?.Owner,
                        pullRequest?.Repository,
                        payload.InputTokens,
                        payload.OutputTokens,
                        payload.CostUsd,
                        payload.DurationMs));
                    break;

                case "failed":
                    var reason = string.IsNullOrWhiteSpace(payload.Detail) ? "The worker reported a failure" : payload.Detail;
                    await commandPipeline.Execute(new FailWork(id, reason));
                    break;

                default:
                    return Results.BadRequest($"Unknown status '{payload.Status}'");
            }

            return Results.Ok();
        });

        app.MapPost("/api/work/{workId}/input", async (
            string workId,
            WorkerInputPayload payload,
            ICurrentUser currentUser,
            IWorkerRuntime workerRuntime,
            CancellationToken cancellationToken) =>
        {
            if (!currentUser.IsAuthenticated)
            {
                return Results.Unauthorized();
            }

            if (!Guid.TryParse(workId, out var parsedWorkId) || string.IsNullOrWhiteSpace(payload.Text))
            {
                return Results.BadRequest();
            }

            await workerRuntime.SendInput(parsedWorkId, payload.Text, cancellationToken);
            return Results.Ok();
        });

        app.MapGet("/api/work/{workId}/log", async (
            string workId,
            HttpResponse response,
            ICurrentUser currentUser,
            IWorkerRuntime workerRuntime,
            CancellationToken cancellationToken) =>
        {
            if (!currentUser.IsAuthenticated)
            {
                response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            if (!Guid.TryParse(workId, out var parsedWorkId))
            {
                response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            response.ContentType = "text/event-stream";
            response.Headers.CacheControl = "no-cache";
            await response.Body.FlushAsync(cancellationToken);

            try
            {
                await foreach (var line in workerRuntime.StreamLogs(parsedWorkId, cancellationToken))
                {
                    await response.WriteAsync($"data: {line}\n\n", cancellationToken);
                    await response.Body.FlushAsync(cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                // The client went away or the worker finished - either way the stream is done.
            }
        });

        return app;
    }
}
