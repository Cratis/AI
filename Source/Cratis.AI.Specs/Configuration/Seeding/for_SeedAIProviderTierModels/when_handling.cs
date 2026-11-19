// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.SettingTierModels;
using Cratis.Monads;

namespace Cratis.AI.Configuration.Seeding.for_SeedAIProviderTierModels;

public class when_handling : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    static readonly TierModels _seeded = TierModels.NotSet with { Fast = "gpt-4.1-mini" };

    Result<IEnumerable<object>, Cratis.Arc.Validation.ValidationResult> _neverSet;
    Result<IEnumerable<object>, Cratis.Arc.Validation.ValidationResult> _everSet;

    void Because()
    {
        var command = new SeedAIProviderTierModels(_providerId, _seeded);
        _neverSet = command.Handle(null);

        // Also what an administrator who set every tier to NotSet (back to vendor defaults) leaves behind:
        // the fact that the table was set, whatever its value - so a restart seeds nothing.
        _everSet = command.Handle(new SeededTierModelsHistory(_providerId, TierModels.NotSet));
    }

    [Fact]
    void should_set_the_models_when_they_were_never_set()
    {
        _neverSet.TryGetResult(out var events);
        events.Single().ShouldEqual(new AIProviderTierModelsSet(_seeded));
    }

    [Fact]
    void should_append_nothing_once_they_were_ever_set_even_back_to_not_set()
    {
        _everSet.TryGetResult(out var events);
        events.ShouldBeEmpty();
    }
}
