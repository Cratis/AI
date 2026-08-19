// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Builds.Listing;

namespace Planner.Builds.RecordingStatus;

/// <summary>
/// Command for recording the most recent conclusion of a repository's workflow - executed by the
/// daily consolidation for every workflow it finds runs for. The full current fact travels every
/// time, so this doubles as "still failing" and "recovered" without a separate event for either.
/// </summary>
/// <param name="Owner">The organization owning the repository.</param>
/// <param name="Repository">The repository the workflow belongs to.</param>
/// <param name="Workflow">The workflow's name.</param>
/// <param name="Conclusion">How the most recent run concluded.</param>
/// <param name="RunUrl">The html URL of the most recent run.</param>
/// <param name="RanAt">When the most recent run finished.</param>
[Command]
public record RecordBuildStatus(
    OrganizationName Owner,
    RepositoryName Repository,
    WorkflowName Workflow,
    BuildConclusion Conclusion,
    BuildRunUrl RunUrl,
    DateTimeOffset RanAt) : ICanProvideEventSourceId
{
    /// <summary>
    /// Gets the predictable event source id for the repository's workflow.
    /// </summary>
    /// <returns>The event source id.</returns>
    public EventSourceId GetEventSourceId() => BuildWorkflowId.From(Owner, Repository, Workflow);

    /// <summary>
    /// Handles the command by appending a <see cref="BuildStatusRecorded"/> event - flagging whether
    /// this is the moment the workflow started failing, so a reactor can analyze it once per failure
    /// rather than once per daily check while it stays red.
    /// </summary>
    /// <param name="current">The workflow's current read model, when it has run before.</param>
    /// <returns>The event.</returns>
    public BuildStatusRecorded Handle(BuildStatus? current)
    {
        var wasAlreadyFailing = current?.Conclusion == BuildConclusion.Failure;
        var isNewFailure = Conclusion == BuildConclusion.Failure && !wasAlreadyFailing;
        return new(Owner, Repository, Workflow, Conclusion, RunUrl, RanAt, isNewFailure);
    }
}

/// <summary>
/// Event raised when the most recent conclusion of a repository's workflow has been recorded.
/// </summary>
/// <param name="Owner">The organization owning the repository.</param>
/// <param name="Repository">The repository the workflow belongs to.</param>
/// <param name="Workflow">The workflow's name.</param>
/// <param name="Conclusion">How the most recent run concluded.</param>
/// <param name="RunUrl">The html URL of the most recent run.</param>
/// <param name="RanAt">When the most recent run finished.</param>
/// <param name="IsNewFailure">Whether this is the moment the workflow started failing, rather than a repeat of an already-known failure.</param>
[EventType]
public record BuildStatusRecorded(
    OrganizationName Owner,
    RepositoryName Repository,
    WorkflowName Workflow,
    BuildConclusion Conclusion,
    BuildRunUrl RunUrl,
    DateTimeOffset RanAt,
    bool IsNewFailure);
