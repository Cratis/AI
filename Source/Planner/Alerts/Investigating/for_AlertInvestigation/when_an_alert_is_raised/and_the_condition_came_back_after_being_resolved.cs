// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Planner.Alerts.Raising;
using Planner.Alerts.Resolving;
using Planner.Work.SchedulingAlertInvestigation;
using Cratis.Arc.Authorization;
using Planner.Identity;

namespace Planner.Alerts.Investigating.for_AlertInvestigation.when_an_alert_is_raised;

/// <summary>
/// A condition that was fixed and came back is a new problem, not the old one, so both raises have
/// to reach an agent.
/// </summary>
/// <remarks>
/// This covers the reactor's own logic and not the attribute that would break it: the in-process
/// scenario harness invokes handlers directly and does not model <c>[OnceOnly]</c>, so this spec
/// passes either way. The reason the reactor suppresses replay with <c>[Replay]</c> instead of
/// carrying <c>[OnceOnly]</c> - whose "once" is once per event *source* - is argued where that
/// decision lives, in <see cref="AlertInvestigation"/>.
/// </remarks>
public class and_the_condition_came_back_after_being_resolved : Specification
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
            .Events(
                Raised("loki-0 has restarted 370 times"),
                new AlertResolved("Cleared the stale lock file", "einari"),
                Raised("loki-0 is crash looping again"));

    static AlertRaised Raised(string summary) => new(
        "studio-production",
        "Loki is crash looping",
        summary,
        AlertSeverity.Critical,
        "pod:studio/loki-0:CrashLoopBackOff");

    [Fact]
    async Task should_investigate_both_times() =>
        await _commandPipeline.Received(2).Execute(Arg.Is<ScheduleAlertInvestigation>(command => command.Alert == _alertId));
}
#endif
