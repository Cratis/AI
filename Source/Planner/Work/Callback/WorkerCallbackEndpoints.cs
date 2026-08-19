// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
            ICommandPipeline commandPipeline,
            IWorkerCallbackTokens callbackTokens) =>
        {
            if (!Guid.TryParse(workId, out var parsedWorkId))
            {
                return Results.BadRequest("Invalid work id");
            }

            WorkId id = parsedWorkId;
            if (!callbackTokens.Validate(id, BearerToken(request)))
            {
                return Results.Unauthorized();
            }

            var work = await eventStore.ReadModels.GetInstanceById<WorkItem>((EventSourceId)id);
            if (work is null)
            {
                return Results.NotFound();
            }

            // Least privilege on the transition itself: a worker that already reported a terminal
            // outcome cannot report a different one afterwards - whichever the Planner accepted
            // first stands, so a compromised or malfunctioning container cannot flip a completed
            // unit of work to failed (or the reverse) after the fact.
            if (IsTerminal(work.Status))
            {
                return Results.Conflict($"Work {id.Value} already reached a terminal state ({work.Status})");
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
                    callbackTokens.Revoke(id);
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
                    callbackTokens.Revoke(id);
                    break;

                case "failed":
                    var reason = string.IsNullOrWhiteSpace(payload.Detail) ? "The worker reported a failure" : payload.Detail;
                    await commandPipeline.Execute(new FailWork(id, reason));
                    callbackTokens.Revoke(id);
                    break;

                default:
                    return Results.BadRequest($"Unknown status '{payload.Status}'");
            }

            return Results.Ok();
        });

        app.MapPost("/api/work/{workId}/input", async (
            string workId,
            WorkerInputPayload payload,
            HttpContext context,
            IWorkerRuntime workerRuntime,
            CancellationToken cancellationToken) =>
        {
            if (!RequireSignedInUser(context))
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
            HttpContext context,
            IWorkerRuntime workerRuntime,
            CancellationToken cancellationToken) =>
        {
            if (!RequireSignedInUser(context))
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

    /// <summary>
    /// Extracts the bearer token from a worker container's callback request.
    /// </summary>
    /// <param name="request">The <see cref="HttpRequest"/> to read the header from.</param>
    /// <returns>The presented token, or <see langword="null"/> when none was given.</returns>
    static string? BearerToken(HttpRequest request)
    {
        var header = request.Headers.Authorization.ToString();
        return header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? header["Bearer ".Length..].Trim() : null;
    }

    /// <summary>
    /// Whether the request carries an authenticated user - these two endpoints are steered and
    /// tailed from the Work page in the browser, not by the worker container, so they authenticate
    /// like the rest of the application rather than with the worker's callback token.
    /// </summary>
    /// <param name="context">The <see cref="HttpContext"/> of the request.</param>
    /// <returns><see langword="true"/> when a signed-in user is making the request.</returns>
    static bool RequireSignedInUser(HttpContext context) => context.User?.Identity?.IsAuthenticated == true;

    /// <summary>
    /// Whether a unit of work has already reached a state no further callback can change.
    /// </summary>
    /// <param name="status">The work's current status.</param>
    /// <returns><see langword="true"/> when the status is terminal.</returns>
    static bool IsTerminal(WorkStatus status) =>
        status is WorkStatus.Completed or WorkStatus.Failed or WorkStatus.Stopped;
}
