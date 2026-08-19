// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues;
using Planner.LanguageModels;
using Planner.Roadmap.RequestingPlan;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Roadmap.GeneratingPlan.for_PlanGeneration.when_plan_is_requested;

public class and_the_language_model_generates_it : given.a_reactor
{
    void Establish()
    {
        SetIssue(new ListedIssue(
            "cratis-studio-1", "Cratis", "Studio", 1, "Something to plan", "Feature", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.Member, true, IssueStatus.None));
        _languageModel.Complete(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(LanguageModelResult.Success("## Plan\n\nDo the thing first."));
    }

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_planId)
            .Events(new PlanRequested([new IssueId("cratis-studio-1")], PlanInstructions.NotSet, "einari"));

    [Fact]
    async Task should_record_the_generated_plan() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<GeneratePlan>(command =>
            command.Plan == _planId && command.Content == new PlanContent("## Plan\n\nDo the thing first.")));

    [Fact]
    async Task should_post_the_plan_back_to_github() =>
        await _gitHub.Received(1).AddIssueComment(
            new OrganizationName("Cratis"), new RepositoryName("Studio"), new IssueNumber(1), Arg.Any<string>(), Arg.Any<CancellationToken>());
}
#endif
