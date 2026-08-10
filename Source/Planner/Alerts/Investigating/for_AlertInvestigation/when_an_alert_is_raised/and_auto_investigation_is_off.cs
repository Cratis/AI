// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Planner.Alerts.Raising;
using Planner.Work.SchedulingAlertInvestigation;

namespace Planner.Alerts.Investigating.for_AlertInvestigation.when_an_alert_is_raised;

public class and_auto_investigation_is_off : Specification
{
    ICommandPipeline _commandPipeline;
    ReactorScenario<AlertInvestigation> _scenario;

    void Establish()
    {
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _scenario = new(new ServiceCollection()
            .AddSingleton(_commandPipeline)
            .AddSingleton(Options.Create(new AlertOptions { AutoInvestigate = false }))
            .BuildServiceProvider());
    }

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff"))
            .Events(new AlertRaised(
                "studio-production",
                "Loki is crash looping",
                "loki-0 has restarted 370 times",
                AlertSeverity.Critical,
                "pod:studio/loki-0:CrashLoopBackOff"));

    [Fact]
    async Task should_leave_the_alert_for_a_person() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<ScheduleAlertInvestigation>());
}
#endif
