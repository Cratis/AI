// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.Raising;

namespace Planner.Alerts.Listing.for_Alert.when_projecting;

public class and_the_condition_is_reported_again : Specification
{
    static readonly AlertId _alertId = AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff");

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
                    AlertSeverity.Warning,
                    "pod:studio/loki-0:CrashLoopBackOff"),
                new AlertObserved("loki-0 has restarted 402 times", AlertSeverity.Critical),
                new AlertObserved("loki-0 has restarted 431 times", AlertSeverity.Critical));

    [Fact] void should_count_every_sighting() => _scenario.Instance.Occurrences.ShouldEqual(3);
    [Fact] void should_hold_the_most_recent_summary() => _scenario.Instance.Summary.ShouldEqual(new AlertSummary("loki-0 has restarted 431 times"));
    [Fact] void should_hold_the_worsened_severity() => _scenario.Instance.Severity.ShouldEqual(AlertSeverity.Critical);
    [Fact] void should_still_be_received() => _scenario.Instance.Status.ShouldEqual(AlertStatus.Received);
}
#endif
