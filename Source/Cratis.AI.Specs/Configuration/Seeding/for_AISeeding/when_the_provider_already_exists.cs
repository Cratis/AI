// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Configuration.Seeding.for_AISeeding;

public class when_the_provider_already_exists : given.a_seeding
{
    bool _created;

    void Establish() => ProviderExists();

    async Task Because() => _created = await _seeding.Apply(_seed);

    [Fact] void should_not_report_a_creation() => _created.ShouldBeFalse();
    [Fact] void should_send_no_commands() => _commands.ShouldBeEmpty();
}
