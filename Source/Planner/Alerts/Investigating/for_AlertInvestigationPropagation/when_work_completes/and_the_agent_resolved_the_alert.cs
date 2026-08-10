// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.RecordingInvestigation;
using Planner.Work.Completing;
using context = Planner.Alerts.Investigating.for_AlertInvestigationPropagation.given.an_alert_investigation;

namespace Planner.Alerts.Investigating.for_AlertInvestigationPropagation.when_work_completes;

public class and_the_agent_resolved_the_alert : context
{
    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(new WorkCompleted(
                "Deleted the stale lock file and the statefulset rolled clean.\n\nALERT-OUTCOME: resolved",
                PullRequestNumber.NotSet,
                PullRequestUrl.NotSet,
                OrganizationName.NotSet,
                RepositoryName.NotSet,
                TokenCount.NotSet,
                TokenCount.NotSet,
                UsageCost.NotSet,
                1000));

    [Fact]
    async Task should_conclude_the_investigation_as_resolved() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ConcludeAlertInvestigation>(command =>
            command.Alert == _alertId && command.Outcome == AlertInvestigationOutcome.Resolved));
}
#endif
