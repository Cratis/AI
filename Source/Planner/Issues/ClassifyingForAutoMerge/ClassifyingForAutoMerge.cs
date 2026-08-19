// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Issues.AcceptingPullRequest;
using Planner.Issues.AssociatingPullRequest;
using Planner.LanguageModels;
using Planner.Repositories;
using ListedRepository = Planner.Repositories.Listing.Repository;

namespace Planner.Issues.ClassifyingForAutoMerge;

/// <summary>
/// Reacts to a pull request being associated with an issue by classifying whether it is safe for an
/// agent to merge on its own, when the repository's <see cref="ReviewGatePolicy"/> allows it - the
/// review gate. A repository still on the default <see cref="ReviewGatePolicy.Human"/> is untouched;
/// the pull request waits for a person exactly as before. Degrades to leaving it for a person when
/// no language model is configured, or the response cannot be parsed.
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> for reading the issue and repository read models.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="languageModel">The <see cref="ILanguageModel"/> the classification is asked from.</param>
public class AutoMergeClassification(IEventStore eventStore, ICommandPipeline commandPipeline, ILanguageModel languageModel) : IReactor
{
    /// <summary>
    /// Classifies a newly associated pull request and merges it when the repository allows auto-merge
    /// and the language model judges it safe.
    /// </summary>
    /// <param name="event">The <see cref="PullRequestAssociated"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public async Task On(PullRequestAssociated @event, EventContext context)
    {
        var repositoryId = RepositoryId.From(@event.PullRequestOwner, @event.PullRequestRepository);
        var repository = await eventStore.ReadModels.GetInstanceById<ListedRepository>((EventSourceId)repositoryId);
        if (repository is null || repository.ReviewGatePolicy != ReviewGatePolicy.Auto)
        {
            return;
        }

        var issueId = new IssueId(context.EventSourceId.Value);
        var issue = await eventStore.ReadModels.GetInstanceById<Listing.Issue>((EventSourceId)issueId);
        if (issue is null)
        {
            return;
        }

        var result = await languageModel.Complete(MergeClassificationPrompts.Classify(issue.Title.Value, @event.Url.Value));
        if (!result.Succeeded)
        {
            return;
        }

        var classification = MergeClassification.Parse(result.Text);
        if (classification?.MergeableNow != true)
        {
            return;
        }

        await commandPipeline.Execute(new AcceptPullRequest(issueId));
    }
}
