// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using Planner.Identity;

namespace Planner.Work.SchedulingAlertInvestigation.when_scheduling_an_alert_investigation;

public class and_an_alert_is_given : Specification
{
    CommandScenario<ScheduleAlertInvestigation> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();
        var currentUser = Substitute.For<Planner.Identity.ICurrentUser>();
        currentUser.GetUserName().Returns(UserName.NotSet);
        _scenario.Services.AddSingleton(currentUser);
    }

    async Task Because()
    {
        // The command requires an authenticated operator; a spec has no HTTP request, so it runs
        // as a trusted system actor - the same scope the production automation uses.
        using var scope = SystemExecutionScope.Enter();
        _result = await _scenario.Execute(
        new ScheduleAlertInvestigation("studio-production-pod-loki-0-crashloopbackoff"));
    }

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_schedule_work_for_the_alert() => _scenario.EventSequence.ShouldHaveAppendedEvent<AlertInvestigationScheduled>(
        @event =>
            @event.Alert == new Alerts.AlertId("studio-production-pod-loki-0-crashloopbackoff") &&
            @event.Model == ModelName.NotSet);
}
#endif
