// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Planner.GitHub;
using Planner.Operations;
using Cratis.Arc.Authorization;
using Planner.Identity;

namespace Planner.Alerts.EscalationReporting.for_AlertEscalationReporting.given;

public class a_reactor : Specification
{
    protected static readonly AlertId _alertId = AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff");

    protected IEventStore _eventStore;
    protected ICommandPipeline _commandPipeline;
    protected IGitHubClient _gitHub;
    protected OperationsOptions _options;

    protected ReactorScenario<AlertEscalationReporting> _scenario;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _gitHub = Substitute.For<IGitHubClient>();
        _options = new();

        _scenario = new(new ServiceCollection()
            .AddSingleton(_eventStore)
            .AddSingleton(_commandPipeline)
            .AddSingleton(_gitHub)
            .AddSingleton<IOptions<OperationsOptions>>(Options.Create(_options))
            .AddSingleton(SystemExecutionScope.ForSpecs())
            .BuildServiceProvider());
    }

    protected void SetAlert(Listing.Alert alert) =>
        _eventStore.ReadModels.GetInstanceById<Listing.Alert>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(alert);
}
#endif
