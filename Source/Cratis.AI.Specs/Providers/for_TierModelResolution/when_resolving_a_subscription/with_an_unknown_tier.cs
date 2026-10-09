// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_resolving_a_subscription;

public class with_an_unknown_tier : Specification
{
    ModelName _result;

    void Because() => _result = TierModelResolution.Resolve(
        new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat-test"), (ModelTier)999);

    [Fact] void should_not_invent_a_model() => _result.ShouldEqual(ModelName.NotSet);
}
