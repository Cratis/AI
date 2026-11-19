// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Providers;
using Cratis.AI.Providers.SettingTierModels;

namespace Cratis.AI.Configuration.Seeding.for_AISeeding;

public class when_nothing_exists : given.a_seeding
{
    bool _created;

    async Task Because() => _created = await _seeding.Apply(_seed);

    [Fact] void should_report_that_it_created_the_provider() => _created.ShouldBeTrue();
    [Fact] void should_send_three_commands() => _commands.Count.ShouldEqual(3);
    [Fact] void should_add_the_provider_first_under_the_seed_identity() =>
        _commands[0].ShouldEqual(new AddSeededOpenAIProvider(_seed.ProviderId, "OpenAI", given.a_seeding.ApiKey));
    [Fact] void should_set_the_tier_models_on_that_provider() =>
        _commands[1].ShouldEqual(new SetAIProviderTierModels(_seed.ProviderId, _seed.TierModels!));
    [Fact] void should_configure_the_agent_on_that_provider() =>
        _commands[2].ShouldEqual(new ConfigureAgent("Greeting", "Greeter", "Answers the greeting.", ModelTier.Fast, ProviderId: _seed.ProviderId));
}
