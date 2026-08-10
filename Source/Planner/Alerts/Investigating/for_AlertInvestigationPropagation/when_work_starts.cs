// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts;
using Planner.Alerts.RecordingInvestigation;
using Planner.Work.Starting;
using context = Planner.Alerts.Investigating.for_AlertInvestigationPropagation.given.an_alert_investigation;

namespace Planner.Alerts.Investigating.for_AlertInvestigationPropagation;

public class when_work_starts : context
{
    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(new WorkStarted(AccountId.New(), "opus"));

    [Fact]
    async Task should_record_that_an_agent_picked_the_alert_up() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<StartAlertInvestigation>(command =>
            command.Alert == _alertId && command.Work == _workId));
}
#endif
