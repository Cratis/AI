// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues;
using Planner.LanguageModels;
using Planner.Roadmap.RequestingPlan;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Roadmap.GeneratingPlan.for_PlanGeneration.when_plan_is_requested;

public class and_no_language_model_is_configured : given.a_reactor
{
    void Establish()
    {
        SetIssue(new ListedIssue(
            "cratis-studio-1", "Cratis", "Studio", 1, "Something to plan", "Feature", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.Member, true, IssueStatus.None));
        _languageModel.Complete(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Failure("No language model is configured"));
    }

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_planId)
            .Events(new PlanRequested([new IssueId("cratis-studio-1")], PlanInstructions.NotSet, "einari"));

    [Fact]
    async Task should_record_the_failure() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<FailPlanGeneration>(command => command.Plan == _planId));

    [Fact]
    async Task should_not_post_anything_to_github() =>
        await _gitHub.DidNotReceive().AddIssueComment(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<IssueNumber>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
}
#endif
