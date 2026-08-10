// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.Raising;

namespace Planner.Alerts.Listing.for_Alert.when_projecting;

public class and_alert_is_raised : Specification
{
    static readonly AlertId _alertId = AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff");

    ReadModelScenario<Alert> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_alertId)
            .Events(new AlertRaised(
                "studio-production",
                "Loki is crash looping",
                "loki-0 has restarted 370 times",
                AlertSeverity.Critical,
                "pod:studio/loki-0:CrashLoopBackOff"));

    [Fact] void should_hold_the_source() => _scenario.Instance.Source.ShouldEqual(new AlertSource("studio-production"));
    [Fact] void should_hold_the_title() => _scenario.Instance.Title.ShouldEqual(new AlertTitle("Loki is crash looping"));
    [Fact] void should_hold_the_severity() => _scenario.Instance.Severity.ShouldEqual(AlertSeverity.Critical);
    [Fact] void should_be_received() => _scenario.Instance.Status.ShouldEqual(AlertStatus.Received);
    [Fact] void should_have_been_seen_once() => _scenario.Instance.Occurrences.ShouldEqual(1);
    [Fact] void should_not_be_investigated_yet() => _scenario.Instance.Work.ShouldBeNull();
}
#endif
