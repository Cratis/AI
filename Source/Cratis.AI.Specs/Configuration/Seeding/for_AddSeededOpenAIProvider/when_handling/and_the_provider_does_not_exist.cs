// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Adding;
using Cratis.Monads;

namespace Cratis.AI.Configuration.Seeding.for_AddSeededOpenAIProvider.when_handling;

public class and_the_provider_does_not_exist : Specification
{
    Result<IEnumerable<object>, Cratis.Arc.Validation.ValidationResult> _result;

    void Because() => _result = new AddSeededOpenAIProvider(AIProviderId.New(), "OpenAI", new AIProviderApiKey("sk-key")).Handle(null);

    [Fact]
    void should_append_the_provider_added_event()
    {
        _result.TryGetResult(out var events);
        events.Single().ShouldBeOfExactType<OpenAIProviderAdded>();
    }
}
