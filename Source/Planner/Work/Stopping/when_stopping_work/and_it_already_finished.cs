// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using Planner.Work.Callback;
using Planner.Work.Listing;
using Planner.Work.Workers;

namespace Planner.Work.Stopping.when_stopping_work;

public class and_it_already_finished : Specification
{
    static readonly WorkId _workId = WorkId.New();

    IWorkerRuntime _workerRuntime;
    IWorkerCallbackTokens _callbackTokens;
    CommandScenario<StopWork> _scenario;
    CommandResult _result;

    void Establish()
    {
        _workerRuntime = Substitute.For<IWorkerRuntime>();
        _callbackTokens = Substitute.For<IWorkerCallbackTokens>();
        _scenario = new();
        _scenario.Services.AddSingleton(_workerRuntime);
        _scenario.Services.AddSingleton(_callbackTokens);
        _scenario.Given.ForEventSource(_workId).ReadModel(new WorkItem(
            _workId,
            WorkPurpose.Implementation,
            [new IssueId("cratis-studio-1")],
            ModelName.NotSet,
            UserName.NotSet,
            WorkStatus.Completed));
    }

    async Task Because() => _result = await _scenario.Execute(new StopWork(_workId));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
    [Fact] async Task should_not_touch_the_worker() => await _workerRuntime.DidNotReceive().Stop(Arg.Any<WorkId>(), Arg.Any<CancellationToken>());
    [Fact] void should_not_revoke_any_callback_token() => _callbackTokens.DidNotReceive().Revoke(Arg.Any<WorkId>());
}
#endif
