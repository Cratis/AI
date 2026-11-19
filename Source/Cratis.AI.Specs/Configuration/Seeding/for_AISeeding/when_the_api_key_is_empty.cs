// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Configuration.Seeding.for_AISeeding;

public class when_the_api_key_is_empty : given.a_seeding
{
    bool _created;

    async Task Because() => _created = await _seeding.Apply(new SeededOpenAIProvider("OpenAI", null, _seed.Agents));

    [Fact] void should_not_report_a_creation() => _created.ShouldBeFalse();
    [Fact] void should_send_no_commands() => _commands.ShouldBeEmpty();
}
