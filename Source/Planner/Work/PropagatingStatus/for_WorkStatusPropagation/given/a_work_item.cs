// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Planner.Work.Listing;
using Cratis.Arc.Authorization;
using Planner.Identity;

namespace Planner.Work.PropagatingStatus.for_WorkStatusPropagation.given;

public class a_work_item : Specification
{
    protected static readonly WorkId _workId = WorkId.New();

    protected IEventStore _eventStore;
    protected ICommandPipeline _commandPipeline;
    protected ReactorScenario<WorkStatusPropagation> _scenario;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _scenario = new(new ServiceCollection()
            .AddSingleton(_eventStore)
            .AddSingleton(_commandPipeline)
            .AddSingleton(SystemExecutionScope.ForSpecs())
            .BuildServiceProvider());
    }

    protected void SetWorkItem(WorkItem work) =>
        _eventStore.ReadModels.GetInstanceById<WorkItem>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(work);
}
#endif
