// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Configuration.Seeding.for_AISeeding;

public class when_the_api_key_is_empty : given.a_seeding
{
    SeedOutcome _outcome;

    async Task Because() => _outcome = await _seeding.Apply(new SeededOpenAIProvider("OpenAI", null, _seed.Agents));

    [Fact] void should_skip() => _outcome.ShouldEqual(SeedOutcome.Skipped);
    [Fact] void should_send_no_commands() => _commands.ShouldBeEmpty();
}
