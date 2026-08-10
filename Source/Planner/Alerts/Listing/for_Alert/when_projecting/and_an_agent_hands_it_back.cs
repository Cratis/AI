// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.Raising;
using Planner.Alerts.RecordingInvestigation;
using Planner.Work;

namespace Planner.Alerts.Listing.for_Alert.when_projecting;

public class and_an_agent_hands_it_back : Specification
{
    static readonly AlertId _alertId = AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff");
    static readonly WorkId _workId = WorkId.New();

    ReadModelScenario<Alert> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_alertId)
            .Events(
                new AlertRaised(
                    "studio-production",
                    "Loki is crash looping",
                    "loki-0 has restarted 370 times",
                    AlertSeverity.Critical,
                    "pod:studio/loki-0:CrashLoopBackOff"),
                new AlertInvestigationStarted(_workId),
                new AlertEscalated("The volume is full and needs resizing - that is a capacity decision"));

    [Fact] void should_need_attention() => _scenario.Instance.Status.ShouldEqual(AlertStatus.NeedsAttention);
    [Fact] void should_hold_the_findings() => _scenario.Instance.Findings.ShouldEqual(new AlertNote("The volume is full and needs resizing - that is a capacity decision"));
    [Fact] void should_link_to_the_investigation() => _scenario.Instance.Work.ShouldEqual(_workId);
    [Fact] void should_not_claim_a_person_resolved_it() => _scenario.Instance.Resolution.ShouldBeNull();
}
#endif
