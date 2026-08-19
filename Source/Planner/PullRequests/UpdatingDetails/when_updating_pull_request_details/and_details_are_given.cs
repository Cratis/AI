// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.PullRequests.UpdatingDetails.when_updating_pull_request_details;

public class and_details_are_given : Specification
{
    CommandScenario<UpdatePullRequestDetails> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new UpdatePullRequestDetails(
        "cratis-studio-42",
        "Fixes the thing",
        [new LabelName("bug")],
        true,
        "fix/the-thing",
        "main"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_pull_request_details_changed() => _scenario.EventSequence.ShouldHaveAppendedEvent<PullRequestDetailsChanged>(
        @event =>
            @event.Body == new PullRequestBody("Fixes the thing") &&
            @event.Draft &&
            @event.HeadBranch == new BranchName("fix/the-thing") &&
            @event.BaseBranch == new BranchName("main") &&
            @event.Labels.Single() == new LabelName("bug"));
}
#endif
