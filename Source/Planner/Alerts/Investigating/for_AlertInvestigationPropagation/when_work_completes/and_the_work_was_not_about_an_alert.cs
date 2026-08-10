// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.RecordingInvestigation;
using Planner.Work;
using Planner.Work.Completing;
using Planner.Work.Listing;
using context = Planner.Alerts.Investigating.for_AlertInvestigationPropagation.given.an_alert_investigation;

namespace Planner.Alerts.Investigating.for_AlertInvestigationPropagation.when_work_completes;

public class and_the_work_was_not_about_an_alert : context
{
    void Establish() => SetWorkItem(new WorkItem(_workId, WorkPurpose.Implementation, [], ModelName.NotSet, UserName.NotSet));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(new WorkCompleted(
                "Opened https://github.com/Cratis/Studio/pull/42",
                42,
                "https://github.com/Cratis/Studio/pull/42",
                "Cratis",
                "Studio",
                TokenCount.NotSet,
                TokenCount.NotSet,
                UsageCost.NotSet,
                1000));

    [Fact]
    async Task should_leave_every_alert_alone() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<ConcludeAlertInvestigation>());
}
#endif
