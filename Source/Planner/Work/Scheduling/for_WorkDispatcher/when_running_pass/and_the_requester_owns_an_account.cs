// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Work.Listing;
using Planner.Work.Starting;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_the_requester_owns_an_account : given.all_dependencies
{
    static readonly WorkId _workId = WorkId.New();
    Accounts.Listing.ClaudeAccount _owned;

    void Establish()
    {
        // The pool account is completely idle; the requester's own account should still win.
        AddAccountWithCredentials();
        _owned = AddAccountWithCredentials(owner: new UserName("einari"));

        _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.InProgress));
        _workItemsData.Add(new WorkItem(_workId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, "einari"));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_dispatch_on_the_requesters_own_account() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<StartWork>(command => command.Account == _owned.Id));
}
#endif
