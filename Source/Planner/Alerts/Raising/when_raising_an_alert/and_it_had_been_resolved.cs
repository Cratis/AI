// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.Listing;

namespace Planner.Alerts.Raising.when_raising_an_alert;

public class and_it_had_been_resolved : Specification
{
    static readonly AlertFingerprint _fingerprint = new("pod:studio/loki-0:CrashLoopBackOff");
    static readonly AlertSource _source = new("studio-production");
    static readonly AlertId _alertId = AlertId.From(_source, _fingerprint);

    CommandScenario<RaiseAlert> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();
        _scenario.Given.ForEventSource(_alertId).ReadModel(new Alert(
            _alertId,
            _source,
            "Loki is crash looping",
            "loki-0 has restarted 370 times",
            AlertSeverity.Critical,
            _fingerprint,
            AlertStatus.Resolved));
    }

    async Task Because() => _result = await _scenario.Execute(new RaiseAlert(
        _source,
        "Loki is crash looping",
        "loki-0 is crash looping again",
        AlertSeverity.Critical,
        _fingerprint));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_raise_the_alert_again() => _scenario.EventSequence.ShouldHaveAppendedEvent<AlertRaised>(
        @event => @event.Summary == new AlertSummary("loki-0 is crash looping again"));
}
#endif
