// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Planner.Issues.Registration;
using Planner.Work.Scheduling;

namespace Planner.Work.AutoInvestigating.for_AutoInvestigation;

public class when_member_issue_is_registered : Specification
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
            .ForEventSource(IssueId.From("Cratis", "Studio", 12))
            .Events(new IssueRegistered("Cratis", "Studio", 12, "Improve the thing", "Feature", "insider", DateTimeOffset.UnixEpoch, AuthorAssociation.Member, true, IssueBody.NotSet, []));

    [Fact]
    async Task should_not_schedule_anything() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<ScheduleWork>());
}
#endif
