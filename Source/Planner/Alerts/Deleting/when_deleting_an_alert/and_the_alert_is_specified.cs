// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Alerts.Deleting.when_deleting_an_alert;

public class and_the_alert_is_specified : Specification
{
    CommandScenario<DeleteAlert> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new DeleteAlert("studio-production-pod-loki-0-crashloopbackoff"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_alert_deleted() => _scenario.EventSequence.ShouldHaveAppendedEvent<AlertDeleted>(_ => true);
}
#endif
