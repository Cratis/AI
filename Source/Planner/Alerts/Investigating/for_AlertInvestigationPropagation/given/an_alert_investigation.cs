// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Planner.Work;
using Planner.Work.Listing;
using Cratis.Arc.Authorization;
using Planner.Identity;

namespace Planner.Alerts.Investigating.for_AlertInvestigationPropagation.given;

public class an_alert_investigation : Specification
{
    protected static readonly WorkId _workId = WorkId.New();
    protected static readonly AlertId _alertId = AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff");

    protected IEventStore _eventStore;
    protected ICommandPipeline _commandPipeline;
    protected ReactorScenario<AlertInvestigationPropagation> _scenario;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _scenario = new(new ServiceCollection()
            .AddSingleton(_eventStore)
            .AddSingleton(_commandPipeline)
            .AddSingleton(SystemExecutionScope.ForSpecs())
            .BuildServiceProvider());

        SetWorkItem(new WorkItem(_workId, WorkPurpose.AlertInvestigation, [], ModelName.NotSet, UserName.NotSet, Alert: _alertId));
    }

    protected void SetWorkItem(WorkItem work) =>
        _eventStore.ReadModels.GetInstanceById<WorkItem>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(work);
}
#endif
