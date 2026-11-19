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

    ConfiguredAIProvider _bare;
    ConfiguredAIProvider _administered;
    Result<IEnumerable<object>, Cratis.Arc.Validation.ValidationResult> _forBare;
    Result<IEnumerable<object>, Cratis.Arc.Validation.ValidationResult> _forAdministered;
    Result<IEnumerable<object>, Cratis.Arc.Validation.ValidationResult> _forMissing;

    void Establish()
    {
        _bare = new ConfiguredAIProvider(_providerId, AIProviderType.OpenAI, new AIProviderApiKey("k"));
        _administered = _bare with { TierModels = TierModels.NotSet with { Fast = "admin-choice" } };
    }

    void Because()
    {
        var command = new SeedAIProviderTierModels(_providerId, _seeded);
        _forBare = command.Handle(_bare);
        _forAdministered = command.Handle(_administered);
        _forMissing = command.Handle(null);
    }

    [Fact]
    void should_set_the_models_when_the_provider_has_none()
    {
        _forBare.TryGetResult(out var events);
        events.Single().ShouldEqual(new AIProviderTierModelsSet(_seeded));
    }

    [Fact]
    void should_append_nothing_when_the_provider_already_has_models()
    {
        _forAdministered.TryGetResult(out var events);
        events.ShouldBeEmpty();
    }

    [Fact] void should_refuse_a_provider_that_is_not_configured() => _forMissing.IsSuccess.ShouldBeFalse();
}
