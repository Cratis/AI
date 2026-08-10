// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Alerts.RecordingInvestigation.when_concluding_an_investigation;

public class and_the_agent_could_not_resolve_it : Specification
{
    CommandScenario<ConcludeAlertInvestigation> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ConcludeAlertInvestigation(
        "studio-production-pod-loki-0-crashloopbackoff",
        AlertInvestigationOutcome.NeedsAttention,
        "The volume is full - resizing it is a capacity decision I should not make"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_hand_the_alert_to_a_person() => _scenario.EventSequence.ShouldHaveAppendedEvent<AlertEscalated>(
        @event => @event.Findings == new AlertNote("The volume is full - resizing it is a capacity decision I should not make"));
}
#endif
