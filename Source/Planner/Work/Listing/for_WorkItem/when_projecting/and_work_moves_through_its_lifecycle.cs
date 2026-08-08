// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts;
using Planner.Work.Completing;
using Planner.Work.Scheduling;
using Planner.Work.Starting;

namespace Planner.Work.Listing.for_WorkItem.when_projecting;

public class and_work_moves_through_its_lifecycle : Specification
{
    static readonly WorkId _workId = WorkId.New();
    static readonly AccountId _accountId = AccountId.New();

    ReadModelScenario<WorkItem> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(
                new WorkScheduled(WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet),
                new WorkStarted(_accountId, "sonnet"),
                new WorkCompleted("All done", 42, "https://github.com/Cratis/Studio/pull/42", "Cratis", "Studio"));

    [Fact] void should_be_completed() => _scenario.Instance.Status.ShouldEqual(WorkStatus.Completed);
    [Fact] void should_hold_the_account() => _scenario.Instance.Account.ShouldEqual(_accountId);
    [Fact] void should_hold_when_it_started() => _scenario.Instance.StartedAt.ShouldNotBeNull();
    [Fact] void should_hold_the_summary() => _scenario.Instance.Summary.ShouldEqual(new WorkSummary("All done"));
    [Fact] void should_hold_the_covered_issues() => _scenario.Instance.Issues.Single().ShouldEqual(new IssueId("cratis-studio-1"));
}
#endif
