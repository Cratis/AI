// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Configuration.Seeding.for_AISeeding;

public class when_seeding_twice : given.a_seeding
{
    int _commandsAfterFirstRun;

    async Task Because()
    {
        await _seeding.Apply(_seed);
        _commandsAfterFirstRun = _commands.Count;

        // The provider's own stream now answers - exactly what the real passive read model does.
        ProviderExists();
        await _seeding.Apply(_seed);
    }

    [Fact] void should_send_commands_the_first_time() => _commandsAfterFirstRun.ShouldEqual(3);
    [Fact] void should_send_nothing_the_second_time() => _commands.Count.ShouldEqual(_commandsAfterFirstRun);
}
