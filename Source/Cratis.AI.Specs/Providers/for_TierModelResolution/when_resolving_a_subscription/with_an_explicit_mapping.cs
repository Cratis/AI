// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_resolving_a_subscription;

public class with_an_explicit_mapping : Specification
{
    ModelName _result;

    void Because() => _result = TierModelResolution.Resolve(
        new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat-test")
        {
            TierModels = new(ModelName.NotSet, "claude-configured", ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [(ModelName)"claude-discovered"]
        },
        ModelTier.Balanced);

    [Fact] void should_keep_the_explicit_choice() => _result.Value.ShouldEqual("claude-configured");
}
