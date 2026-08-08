// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Work.Completing;
using Planner.Work.CompletingInvestigation;
using Planner.Work.Failing;
using Planner.Work.Listing;

namespace Planner.Work.Callback;

/// <summary>
/// The payload a worker container posts back to the Planner.
/// </summary>
/// <param name="Status">The reported status: <c>started</c>, <c>completed</c> or <c>failed</c>.</param>
/// <param name="Detail">The result or failure detail the worker reported.</param>
public record WorkerCallbackPayload(string Status, string Detail);

/// <summary>
/// The transport boundary worker containers report progress through. This is deliberately not an
/// Arc command - the caller is an external process with a free-form payload that gets translated
/// into the Planner's commands here.
/// </summary>
public static class WorkerCallbackEndpoints
{
    /// <summary>
    /// Maps the worker callback endpoint.
    /// </summary>
    /// <param name="app">The <see cref="WebApplication"/> to map on.</param>
    /// <returns>The same <see cref="WebApplication"/> for chaining.</returns>
    public static WebApplication MapWorkerCallbacks(this WebApplication app)
    {
        app.MapPost("/api/work/{workId}/callback", async (
            string workId,
            WorkerCallbackPayload payload,
            IEventStore eventStore,
            ICommandPipeline commandPipeline) =>
        {
            if (!Guid.TryParse(workId, out var parsedWorkId))
            {
                return Results.BadRequest("Invalid work id");
            }

            WorkId id = parsedWorkId;
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
                    await commandPipeline.Execute(new CompleteInvestigation(id, payload.Detail, suggestedModel));
                    break;

                case "completed":
                    var pullRequest = WorkerResults.TryFindPullRequest(payload.Detail);
                    await commandPipeline.Execute(pullRequest is null
                        ? new CompleteWork(id, payload.Detail)
                        : new CompleteWork(id, payload.Detail, pullRequest.Number, pullRequest.Url, pullRequest.Owner, pullRequest.Repository));
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

        return app;
    }
}
