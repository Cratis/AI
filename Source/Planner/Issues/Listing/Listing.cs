// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Issues.AssociatingPullRequest;
using Planner.Issues.ChangingAssignees;
using Planner.Issues.ChangingBody;
using Planner.Issues.ChangingLabels;
using Planner.Issues.ChangingMilestone;
using Planner.Issues.ChangingStatus;
using Planner.Issues.Classifying;
using Planner.Issues.Closing;
using Planner.Issues.Comments.Recording;
using Planner.Issues.Comments.Removing;
using Planner.Issues.Grouping;
using Planner.Issues.Grouping.Creating;
using Planner.Issues.Grouping.RemovingIssue;
using Planner.Issues.RecordingInvestigation;
using Planner.Issues.Registration;
using Planner.Issues.Renaming;
using Planner.Issues.Reopening;
using Planner.Issues.Reordering;
using Planner.Issues.SettingModel;
using Planner.Issues.SettingPriority;
using Planner.Issues.SettingPrompt;

namespace Planner.Issues.Listing;

/// <summary>
/// A comment on an issue as mirrored from GitHub.
/// </summary>
/// <param name="Id">The identity of the comment on GitHub.</param>
/// <param name="Author">The login of the user that wrote the comment.</param>
/// <param name="Body">The markdown body of the comment.</param>
/// <param name="CommentedAt">When the comment was written on GitHub.</param>
public record IssueComment(CommentId Id, UserName Author, CommentBody Body, DateTimeOffset CommentedAt);

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
/// <param name="OverriddenModel">The model explicitly set by a user - takes precedence over <see cref="SuggestedModel"/> when set to anything other than <see cref="ModelName.NotSet"/>.</param>
/// <param name="Body">The markdown body of the issue.</param>
/// <param name="Labels">The labels on the issue.</param>
/// <param name="Prompt">Extra instructions attached to the issue for the agent working on it.</param>
/// <param name="Priority">How urgently the issue should be worked on - explicit, set by a person.</param>
/// <param name="Assignees">The logins of the users the issue is assigned to on GitHub.</param>
/// <param name="Milestone">The milestone the issue is attached to on GitHub - <see cref="MilestoneName.NotSet"/> for none.</param>
/// <param name="Kind">What kind of issue triage classified this as.</param>
/// <param name="Feasibility">Whether triage judged an agent can act on it.</param>
/// <param name="SuggestedPriority">The priority triage suggests - overridden by an explicit <see cref="Priority"/>.</param>
/// <param name="SuggestedLabels">The labels triage suggested.</param>
/// <param name="Area">The affected area, as triage classified it.</param>
/// <param name="Comments">The comments on the issue as mirrored from GitHub.</param>
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
    ModelName? SuggestedModel = null,
    [SetFrom<IssueModelOverridden>(nameof(IssueModelOverridden.Model))]
    ModelName? OverriddenModel = null,
    [SetFrom<IssueBodyChanged>(nameof(IssueBodyChanged.Body))]
    IssueBody? Body = null,
    [SetFrom<IssueLabelsChanged>(nameof(IssueLabelsChanged.Labels))]
    IEnumerable<LabelName>? Labels = null,
    [SetFrom<IssuePromptSet>(nameof(IssuePromptSet.Prompt))]
    WorkPrompt? Prompt = null,
    [SetFrom<IssuePrioritySet>(nameof(IssuePrioritySet.Priority))]
    Priority Priority = Priority.NotSet,
    [SetFrom<IssueAssigneesChanged>(nameof(IssueAssigneesChanged.Assignees))]
    IEnumerable<UserName>? Assignees = null,
    [SetFrom<IssueMilestoneChanged>(nameof(IssueMilestoneChanged.Milestone))]
    MilestoneName? Milestone = null,
    [SetFrom<IssueClassified>(nameof(IssueClassified.Kind))]
    IssueKind Kind = IssueKind.Unclassified,
    [SetFrom<IssueClassified>(nameof(IssueClassified.Feasibility))]
    IssueFeasibility Feasibility = IssueFeasibility.Unclassified,
    [SetFrom<IssueClassified>(nameof(IssueClassified.SuggestedPriority))]
    Priority? SuggestedPriority = null,
    [SetFrom<IssueClassified>(nameof(IssueClassified.SuggestedLabels))]
    IEnumerable<LabelName>? SuggestedLabels = null,
    [SetFrom<IssueClassified>(nameof(IssueClassified.Area))]
    IssueArea? Area = null,
    [ChildrenFrom<IssueCommentAdded>(key: nameof(IssueCommentAdded.Comment), identifiedBy: nameof(IssueComment.Id))]
    [RemovedWith<IssueCommentRemoved>(key: nameof(IssueCommentRemoved.Comment))]
    IEnumerable<IssueComment>? Comments = null)
{
    /// <summary>
    /// Observes all issues across every tracked repository, open and closed alike - the history
    /// view behind the "Show done" toggle. <see cref="OpenIssues"/> is what every default view uses.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the issues.</param>
    /// <returns>An observable of all issues.</returns>
    public static ISubject<IEnumerable<Issue>> AllIssues(IMongoCollection<Issue> collection) =>
        collection.Observe();

    /// <summary>
    /// Observes the issues that are still open on GitHub - the default view everywhere, so a
    /// closed issue disappears the moment the mirror learns about it instead of relying on the
    /// browser to filter rows it never needed to receive.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the issues.</param>
    /// <returns>An observable of the open issues.</returns>
    public static ISubject<IEnumerable<Issue>> OpenIssues(IMongoCollection<Issue> collection) =>
        collection.Observe(issue => issue.IsOpen);
}
