// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Alerts.RecordingInvestigation.when_concluding_an_investigation;

public class and_the_agent_resolved_it : Specification
{
    CommandScenario<ConcludeAlertInvestigation> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ConcludeAlertInvestigation(
        "studio-production-pod-loki-0-crashloopbackoff",
        AlertInvestigationOutcome.Resolved,
        "The pod was wedged on a stale lock file; deleted it and the statefulset rolled clean"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_record_that_the_agent_resolved_it() => _scenario.EventSequence.ShouldHaveAppendedEvent<AlertResolvedByAgent>(
        @event => @event.Findings == new AlertNote("The pod was wedged on a stale lock file; deleted it and the statefulset rolled clean"));
}
#endif
