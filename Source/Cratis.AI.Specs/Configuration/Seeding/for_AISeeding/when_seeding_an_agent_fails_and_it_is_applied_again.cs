// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Execution;

namespace Cratis.AI.Configuration.Seeding.for_AISeeding;

public class when_seeding_an_agent_fails_and_it_is_applied_again : given.a_seeding
{
    SeedOutcome _first;
    SeedOutcome _second;

    void Establish() =>
        _commandPipeline.Execute(Arg.Is<object>(_ => _ is SeedAgent)).Returns(CommandResult.Error(CorrelationId.New(), "refused"));

    async Task Because()
    {
        _first = await _seeding.Apply(_seed);

        _commandPipeline.Execute(Arg.Is<object>(_ => _ is SeedAgent)).Returns(CommandResult.Success(CorrelationId.New()));
        _commands.Clear();
        _second = await _seeding.Apply(_seed);
    }

    [Fact] void should_report_the_first_run_as_failed() => _first.ShouldEqual(SeedOutcome.Failed);
    [Fact] void should_complete_on_the_later_run() => _second.ShouldEqual(SeedOutcome.Completed);
    [Fact] void should_send_the_agent_again_on_the_later_run() => _commands.OfType<SeedAgent>().Count().ShouldEqual(1);
}
