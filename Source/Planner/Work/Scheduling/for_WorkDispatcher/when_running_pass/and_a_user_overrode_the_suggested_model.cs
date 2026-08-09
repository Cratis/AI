// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Work.Listing;
using Planner.Work.Starting;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_a_user_overrode_the_suggested_model : given.all_dependencies
{
    static readonly WorkId _workId = WorkId.New();

    void Establish()
    {
        AddAccountWithCredentials();
        _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.ReadyForDevelopment, suggestedModel: "opus", overriddenModel: "haiku"));
        _workItemsData.Add(new WorkItem(_workId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_record_the_start_with_the_overridden_model() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<StartWork>(command =>
            command.Work == _workId &&
            command.Model == new ModelName("haiku")));
}
#endif
