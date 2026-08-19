// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.AutoConvertingToIssue;
using Planner.Alerts.RecordingInvestigation;

namespace Planner.Alerts.EscalationReporting.for_AlertEscalationReporting.when_alert_escalates;

public class and_it_already_has_an_issue : given.a_reactor
{
    void Establish()
    {
        _options.IssueOwner = "Cratis";
        _options.IssueRepository = "Ops";
        SetAlert(new Listing.Alert(
            _alertId,
            "studio-production",
            "Loki is crash looping",
            "loki-0 has restarted 370 times",
            AlertSeverity.Critical,
            "pod:studio/loki-0:CrashLoopBackOff",
            Issue: 88,
            IssueOwner: "Cratis",
            IssueRepository: "Ops"));
    }

    async Task Because() => await _scenario.Given.ForEventSource(_alertId).Events(new AlertEscalated("It is still full"));

    [Fact]
    async Task should_comment_on_the_existing_issue() =>
        await _gitHub.Received(1).AddIssueComment(
            new OrganizationName("Cratis"), new RepositoryName("Ops"), new IssueNumber(88), Arg.Is<string>(body => body.Contains("It is still full", StringComparison.Ordinal)), Arg.Any<CancellationToken>());

    [Fact]
    async Task should_not_file_a_second_issue() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<AutoConvertAlertToIssue>());
}
#endif
