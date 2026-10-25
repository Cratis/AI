// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_resolving_a_subscription;

public class with_a_discovered_catalog : Specification
{
    ModelName _result;

    void Because() => _result = TierModelResolution.Resolve(
        new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat-test")
        {
            AvailableModels = [(ModelName)"claude-discovered"]
        },
        ModelTier.Balanced);

    [Fact] void should_use_the_discovered_model_before_an_alias() => _result.Value.ShouldEqual("claude-discovered");
}
