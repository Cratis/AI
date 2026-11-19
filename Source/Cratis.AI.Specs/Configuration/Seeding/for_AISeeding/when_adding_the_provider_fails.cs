// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Execution;

namespace Cratis.AI.Configuration.Seeding.for_AISeeding;

public class when_adding_the_provider_fails : given.a_seeding
{
    bool _created;

    void Establish() =>
        _commandPipeline.Execute(Arg.Any<object>()).Returns(CommandResult.Error(CorrelationId.New(), "refused"));

    async Task Because() => _created = await _seeding.Apply(_seed);

    [Fact] void should_not_report_a_creation() => _created.ShouldBeFalse();
    [Fact] void should_not_configure_anything_for_a_provider_that_was_not_added() => _commands.Count.ShouldEqual(1);
    [Fact] void should_not_show_the_api_key_when_the_seed_is_printed() => _seed.ToString().ShouldNotContain(given.a_seeding.ApiKey);
}
