// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Alerts.Raising.when_raising_an_alert;

public class and_the_condition_is_new : Specification
{
    CommandScenario<RaiseAlert> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RaiseAlert(
        "studio-production",
        "Loki is crash looping",
        "loki-0 has restarted 370 times",
        AlertSeverity.Critical,
        "pod:studio/loki-0:CrashLoopBackOff"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_raise_the_alert() => _scenario.EventSequence.ShouldHaveAppendedEvent<AlertRaised>(
        @event =>
            @event.Source == new AlertSource("studio-production") &&
            @event.Title == new AlertTitle("Loki is crash looping") &&
            @event.Severity == AlertSeverity.Critical);
}
#endif
