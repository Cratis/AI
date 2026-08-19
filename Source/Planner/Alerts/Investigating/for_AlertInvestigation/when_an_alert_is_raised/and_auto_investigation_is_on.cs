// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Planner.Alerts.Raising;
using Planner.Work.SchedulingAlertInvestigation;
using Cratis.Arc.Authorization;
using Planner.Identity;

namespace Planner.Alerts.Investigating.for_AlertInvestigation.when_an_alert_is_raised;

public class and_auto_investigation_is_on : Specification
{
    static readonly AlertId _alertId = AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff");

    ICommandPipeline _commandPipeline;
    ReactorScenario<AlertInvestigation> _scenario;

    void Establish()
    {
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _scenario = new(new ServiceCollection()
            .AddSingleton(_commandPipeline)
            .AddSingleton(Options.Create(new AlertOptions()))
            .AddSingleton(SystemExecutionScope.ForSpecs())
            .BuildServiceProvider());
    }

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_alertId)
            .Events(new AlertRaised(
                "studio-production",
                "Loki is crash looping",
                "loki-0 has restarted 370 times",
                AlertSeverity.Critical,
                "pod:studio/loki-0:CrashLoopBackOff"));

    [Fact]
    async Task should_put_an_agent_on_the_alert() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ScheduleAlertInvestigation>(command => command.Alert == _alertId));
}
#endif
