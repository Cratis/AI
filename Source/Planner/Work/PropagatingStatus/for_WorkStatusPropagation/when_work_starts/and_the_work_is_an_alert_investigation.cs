// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts;
using Planner.Issues.ChangingStatus;
using Planner.Work.Listing;
using Planner.Work.Starting;
using Cratis.Arc.Authorization;

namespace Planner.Work.PropagatingStatus.for_WorkStatusPropagation.when_work_starts;

/// <summary>
/// An alert investigation is scheduled by an event that carries no issues at all, so nothing
/// populates <see cref="WorkItem.Issues"/> and it comes back unset. The reactor subscribes to
/// <see cref="WorkStarted"/> for every purpose, so this is a shape it genuinely sees in production.
/// The handler is invoked directly rather than through the scenario, because the reactor invoker -
/// in the scenario exactly as in production - captures a handler exception into its invocation
/// result instead of surfacing it. A throw would therefore look like a passing spec here, while in
/// production it pauses the partition and can quarantine the observer for good.
/// </summary>
public class and_the_work_is_an_alert_investigation : given.a_work_item
{
    WorkStatusPropagation _reactor;
    Exception _error;

    void Establish()
    {
        SetWorkItem(new WorkItem(
            _workId,
            WorkPurpose.AlertInvestigation,
            null!,
            ModelName.NotSet,
            UserName.NotSet));
        _reactor = new(_eventStore, _commandPipeline, Substitute.For<ISystemExecution>());
    }

    async Task Because() => _error = await Cratis.Specifications.Catch.Exception(() =>
        _reactor.On(new WorkStarted(AccountId.New(), "sonnet"), EventContext.EmptyWithEventSourceId(_workId)));

    [Fact] void should_not_fail_the_partition() => _error.ShouldBeNull();

    [Fact]
    async Task should_leave_every_issue_alone() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<ChangeIssueStatus>());
}
#endif
