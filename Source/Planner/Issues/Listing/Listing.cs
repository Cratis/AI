// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Issues.AssociatingPullRequest;
using Planner.Issues.ChangingStatus;
using Planner.Issues.Closing;
using Planner.Issues.Grouping;
using Planner.Issues.Grouping.Creating;
using Planner.Issues.Grouping.RemovingIssue;
using Planner.Issues.RecordingInvestigation;
using Planner.Issues.Registration;
using Planner.Issues.Renaming;
using Planner.Issues.Reopening;
using Planner.Issues.Reordering;

namespace Planner.Issues.Listing;

/// <summary>
/// Read model for the issue list - the vitals of every mirrored issue together with the Planner's
/// own status, grouping, ordering, pull request and investigation state.
/// </summary>
/// <param name="Id">The issue identity - the predictable <c>{org}-{repo}-{issue}</c> key.</param>
/// <param name="Owner">The organization owning the repository the issue lives in.</param>
/// <param name="Repository">The repository the issue lives in.</param>
/// <param name="Number">The issue number.</param>
/// <param name="Title">The issue title.</param>
/// <param name="Type">The issue type as classified on GitHub.</param>
/// <param name="CreatedBy">The login of the user that created the issue.</param>
/// <param name="CreatedAt">When the issue was created on GitHub.</param>
/// <param name="AuthorAssociation">The author's association with the repository.</param>
/// <param name="IsOpen">Whether the issue is open on GitHub.</param>
/// <param name="Status">The Planner's internal status.</param>
/// <param name="Order">The manual sort position - <see langword="null"/> until the issue has been dragged.</param>
/// <param name="Group">The group the issue belongs to - <see langword="null"/> when ungrouped.</param>
/// <param name="PullRequest">The associated pull request number - <see langword="null"/> until work produced one.</param>
/// <param name="PullRequestUrl">The associated pull request URL.</param>
/// <param name="PullRequestOwner">The organization owning the repository the pull request was opened in.</param>
/// <param name="PullRequestRepository">The repository the pull request was opened in.</param>
/// <param name="Investigation">The investigation summary - <see langword="null"/> until investigated.</param>
/// <param name="SuggestedModel">The model an investigation suggested for implementing the issue.</param>
[ReadModel]
[FromEvent<IssueRegistered>]
public record Issue(
    IssueId Id,
    OrganizationName Owner,
    RepositoryName Repository,
    IssueNumber Number,
    [SetFrom<IssueRenamed>]
    IssueTitle Title,
    IssueType Type,
    UserName CreatedBy,
    DateTimeOffset CreatedAt,
    AuthorAssociation AuthorAssociation,
    [SetValue<IssueClosed>(false)]
    [SetValue<IssueReopened>(true)]
    bool IsOpen,
    [SetValue<IssueMarkedReadyForDevelopment>(IssueStatus.ReadyForDevelopment)]
    [SetValue<IssueDevelopmentStarted>(IssueStatus.InProgress)]
    [SetValue<IssueMarkedForReview>(IssueStatus.ForReview)]
    [SetValue<IssueStatusCleared>(IssueStatus.None)]
    IssueStatus Status = IssueStatus.None,
    [SetFrom<IssueReordered>(nameof(IssueReordered.Order))]
    SortOrder? Order = null,
    [SetFrom<IssueAddedToGroup>(nameof(IssueAddedToGroup.Group))]
    [SetValue<IssueRemovedFromGroup>("")]
    GroupId? Group = null,
    [SetFrom<PullRequestAssociated>(nameof(PullRequestAssociated.Number))]
    PullRequestNumber? PullRequest = null,
    [SetFrom<PullRequestAssociated>(nameof(PullRequestAssociated.Url))]
    PullRequestUrl? PullRequestUrl = null,
    [SetFrom<PullRequestAssociated>(nameof(PullRequestAssociated.PullRequestOwner))]
    OrganizationName? PullRequestOwner = null,
    [SetFrom<PullRequestAssociated>(nameof(PullRequestAssociated.PullRequestRepository))]
    RepositoryName? PullRequestRepository = null,
    [SetFrom<IssueInvestigated>(nameof(IssueInvestigated.Summary))]
    InvestigationSummary? Investigation = null,
    [SetFrom<IssueInvestigated>(nameof(IssueInvestigated.SuggestedModel))]
    ModelName? SuggestedModel = null)
{
    /// <summary>
    /// Observes all issues across every tracked repository.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the issues.</param>
    /// <returns>An observable of all issues.</returns>
    public static ISubject<IEnumerable<Issue>> AllIssues(IMongoCollection<Issue> collection) =>
        collection.Observe();
}
