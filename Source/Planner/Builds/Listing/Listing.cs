// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Builds.RecordingStatus;

namespace Planner.Builds.Listing;

/// <summary>
/// Read model for the most recent status of every workflow the daily consolidation has checked -
/// one row per repository/workflow, always the latest conclusion, never history.
/// </summary>
/// <param name="Id">The workflow identity - the predictable <c>{org}-{repo}-{workflow}</c> key.</param>
/// <param name="Owner">The organization owning the repository.</param>
/// <param name="Repository">The repository the workflow belongs to.</param>
/// <param name="Workflow">The workflow's name.</param>
/// <param name="Conclusion">How the most recent run concluded.</param>
/// <param name="RunUrl">The html URL of the most recent run.</param>
/// <param name="RanAt">When the most recent run finished.</param>
[ReadModel]
[FromEvent<BuildStatusRecorded>]
public record BuildStatus(
    BuildWorkflowId Id,
    OrganizationName Owner,
    RepositoryName Repository,
    WorkflowName Workflow,
    BuildConclusion Conclusion,
    BuildRunUrl RunUrl,
    DateTimeOffset RanAt)
{
    /// <summary>
    /// Observes every workflow the daily consolidation has checked, whatever it last concluded.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the build statuses.</param>
    /// <returns>An observable of every checked workflow.</returns>
    public static ISubject<IEnumerable<BuildStatus>> AllBuildStatuses(IMongoCollection<BuildStatus> collection) =>
        collection.Observe();

    /// <summary>
    /// Observes the workflows whose most recent run failed - the default view, so a workflow that
    /// goes green again disappears from it automatically.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the build statuses.</param>
    /// <returns>An observable of the failing workflows.</returns>
    public static ISubject<IEnumerable<BuildStatus>> FailedBuilds(IMongoCollection<BuildStatus> collection) =>
        collection.Observe(build => build.Conclusion == BuildConclusion.Failure);
}
