// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Configuration.Seeding.for_AISeeding;

public class when_nothing_exists : given.a_seeding
{
    SeedOutcome _outcome;

    async Task Because() => _outcome = await _seeding.Apply(_seed);

    [Fact] void should_complete() => _outcome.ShouldEqual(SeedOutcome.Completed);
    [Fact] void should_send_three_commands() => _commands.Count.ShouldEqual(3);
    [Fact] void should_add_the_provider_first_under_the_seed_identity() =>
        _commands[0].ShouldEqual(new AddSeededOpenAIProvider(_seed.ProviderId, "OpenAI", given.a_seeding.ApiKey));
    [Fact] void should_seed_the_tier_models_on_that_provider() =>
        _commands[1].ShouldEqual(new SeedAIProviderTierModels(_seed.ProviderId, _seed.TierModels!));
    [Fact] void should_seed_the_agent_on_that_provider() =>
        _commands[2].ShouldEqual(new SeedAgent("Greeting", "Greeter", "Answers the greeting.", ModelTier.Fast, _seed.ProviderId));
}
