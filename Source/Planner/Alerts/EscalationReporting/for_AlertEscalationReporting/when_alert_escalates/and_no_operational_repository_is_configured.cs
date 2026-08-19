// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.AutoConvertingToIssue;
using Planner.Alerts.RecordingInvestigation;

namespace Planner.Alerts.EscalationReporting.for_AlertEscalationReporting.when_alert_escalates;

public class and_no_operational_repository_is_configured : given.a_reactor
{
    void Establish() => SetAlert(new Listing.Alert(
        _alertId, "studio-production", "Loki is crash looping", "loki-0 has restarted 370 times", AlertSeverity.Critical, "pod:studio/loki-0:CrashLoopBackOff"));

    async Task Because() => await _scenario.Given.ForEventSource(_alertId).Events(new AlertEscalated("The volume is full"));

    [Fact]
    async Task should_not_file_an_issue() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<AutoConvertAlertToIssue>());

    [Fact]
    async Task should_not_comment_on_github() =>
        await _gitHub.DidNotReceive().AddIssueComment(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<IssueNumber>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
}
#endif
