// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Arc.Authorization;
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Planner.GitHub;
using Planner.Issues.RecordingInvestigation;
using Planner.Work.CompletingInvestigation;
using Planner.Work.Listing;

namespace Planner.Work.ReportingInvestigation.for_InvestigationReporting;

public class when_investigation_completes : Specification
{
    static readonly WorkId _workId = WorkId.New();
    static readonly IssueId _issueId = new("cratis-studio-1");

    IEventStore _eventStore;
    ICommandPipeline _commandPipeline;
    IGitHubClient _gitHub;
    ISystemExecution _systemExecution;
    ReactorScenario<InvestigationReporting> _scenario;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        _eventStore.ReadModels.GetInstanceById<WorkItem>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(new WorkItem(_workId, WorkPurpose.Investigation, [_issueId], ModelName.NotSet, UserName.NotSet));

        _commandPipeline = Substitute.For<ICommandPipeline>();
        _gitHub = Substitute.For<IGitHubClient>();
        _systemExecution = Substitute.For<ISystemExecution>();

        _scenario = new(new ServiceCollection()
            .AddSingleton(_eventStore)
            .AddSingleton(_commandPipeline)
            .AddSingleton(_gitHub)
            .AddSingleton(_systemExecution)
            .BuildServiceProvider());
    }

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(new InvestigationCompleted("Split the reducer and project the totals instead", "opus", TokenCount.NotSet, TokenCount.NotSet, UsageCost.NotSet, 1000));

    [Fact]
    async Task should_record_the_findings_on_the_covered_issue() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordInvestigation>(command => command.Issue == _issueId));

    // A reactor has no HTTP request behind it - proves recording the findings runs inside the
    // trusted system scope rather than relying on (nonexistent) ambient authorization.
    [Fact] void should_report_as_the_system() => _systemExecution.Received(1).AsSystem();
}
#endif
