// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues;
using Planner.Work.Listing;
using context = Planner.Work.Workers.for_WorkerEnvironment.given.all_dependencies;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.Workers.for_WorkerEnvironment.when_building_for_issue_work;

public class and_a_callback_token_is_given : context
{
    static readonly ListedIssue _issue = new(
        "Cratis/Studio#1",
        "Cratis",
        "Studio",
        1,
        "An issue",
        "Bug",
        "someuser",
        DateTimeOffset.UtcNow,
        AuthorAssociation.Member,
        true,
        IssueStatus.ReadyForDevelopment);

    WorkerEnvironmentResult _result;

    void Establish() => BuildEnvironmentBuilder();

    async Task Because() => _result = await _environment.Build(
        new WorkItem(_workId, WorkPurpose.Implementation, [_issue.Id], ModelName.NotSet, UserName.NotSet),
        [_issue],
        _credentials,
        "sonnet",
        _callbackToken);

    [Fact] void should_hand_the_worker_its_callback_token() => _result.Secrets["PLANNER_CALLBACK_TOKEN"].ShouldEqual(_callbackToken.Value);

    // The token authenticates the worker, so it must not also sit on the container specification -
    // that is what `kubectl get job -o yaml` and `docker inspect` read back.
    [Fact] void should_keep_it_off_the_container_specification() => _result.Variables.ContainsKey("PLANNER_CALLBACK_TOKEN").ShouldBeFalse();
}
#endif
