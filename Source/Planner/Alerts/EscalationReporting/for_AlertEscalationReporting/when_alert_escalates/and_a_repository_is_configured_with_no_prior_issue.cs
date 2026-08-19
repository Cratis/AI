// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.AutoConvertingToIssue;
using Planner.Alerts.RecordingInvestigation;

namespace Planner.Alerts.EscalationReporting.for_AlertEscalationReporting.when_alert_escalates;

public class and_a_repository_is_configured_with_no_prior_issue : given.a_reactor
{
    void Establish()
    {
        _options.IssueOwner = "Cratis";
        _options.IssueRepository = "Ops";
        SetAlert(new Listing.Alert(
            _alertId, "studio-production", "Loki is crash looping", "loki-0 has restarted 370 times", AlertSeverity.Critical, "pod:studio/loki-0:CrashLoopBackOff"));
    }

    async Task Because() => await _scenario.Given.ForEventSource(_alertId).Events(new AlertEscalated("The volume is full"));

    [Fact]
    async Task should_file_an_issue_in_the_operational_repository() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<AutoConvertAlertToIssue>(command =>
            command.Alert == _alertId &&
            command.Owner == new OrganizationName("Cratis") &&
            command.Repository == new RepositoryName("Ops") &&
            command.Body.Value.Contains("The volume is full", StringComparison.Ordinal)));
}
#endif
