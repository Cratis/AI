// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.Monads;

namespace Cratis.AI.Configuration.Seeding.for_AddSeededOpenAIProvider.when_handling;

public class and_the_provider_already_exists : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();

    Result<IEnumerable<object>, Cratis.Arc.Validation.ValidationResult> _result;

    void Because() => _result = new AddSeededOpenAIProvider(_providerId, "OpenAI", new AIProviderApiKey("sk-other"))
        .Handle(new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, new AIProviderApiKey("sk-existing")));

    [Fact] void should_succeed() => _result.IsSuccess.ShouldBeTrue();

    [Fact]
    void should_append_nothing()
    {
        _result.TryGetResult(out var events);
        events.ShouldBeEmpty();
    }
}
