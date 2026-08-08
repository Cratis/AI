// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Planner.Issues.Registration;
using Planner.Work.Scheduling;

namespace Planner.Work.AutoInvestigating.for_AutoInvestigation;

public class when_external_issue_is_registered : Specification
{
    ICommandPipeline _commandPipeline;
    ReactorScenario<AutoInvestigation> _scenario;

    void Establish()
    {
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _scenario = new(new ServiceCollection()
            .AddSingleton(_commandPipeline)
            .AddSingleton(Options.Create(new SchedulingOptions()))
            .BuildServiceProvider());
    }

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(IssueId.From("Cratis", "StudioIssues", 12))
            .Events(new IssueRegistered("Cratis", "StudioIssues", 12, "It is broken", "Bug", "outsider", DateTimeOffset.UnixEpoch, AuthorAssociation.External, true));

    [Fact]
    async Task should_schedule_an_investigation_with_the_investigation_model() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ScheduleWork>(command =>
            command.Purpose == WorkPurpose.Investigation &&
            command.Issues.Single() == new IssueId("cratis-studioissues-12") &&
            command.Model == new ModelName("opus")));
}
#endif
