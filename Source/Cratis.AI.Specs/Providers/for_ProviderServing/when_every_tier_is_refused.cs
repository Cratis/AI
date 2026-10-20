// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_ProviderServing;

public class when_every_tier_is_refused : Specification
{
    ConfiguredAIProvider _provider;
    bool _canServe;

    void Establish() => _provider = new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-test")
    {
        TierModels = new("retired-haiku", "retired-sonnet", "retired-opus", "retired-fable"),
        AvailableModels = [new("claude-sonnet-4-5")]
    };

    void Because() => _canServe = _provider.CanServe(DateTimeOffset.UtcNow);

    [Fact] void should_not_serve_a_completion() => _canServe.ShouldBeFalse();
}
