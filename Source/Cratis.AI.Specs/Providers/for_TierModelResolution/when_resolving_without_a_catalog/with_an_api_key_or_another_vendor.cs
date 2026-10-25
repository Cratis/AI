// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_resolving_without_a_catalog;

public class with_an_api_key_or_another_vendor : Specification
{
    ModelName[] _models;

    void Because() => _models =
    [
        TierModelResolution.Resolve(new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-api-test"), ModelTier.Balanced),
        TierModelResolution.Resolve(new(AIProviderId.New(), AIProviderType.OpenAI, "sk-ant-oat-test"), ModelTier.Balanced),
        TierModelResolution.Resolve(new(AIProviderId.New(), AIProviderType.Anthropic, AIProviderApiKey.NotSet), ModelTier.Balanced)
    ];

    [Fact] void should_not_send_cli_aliases_to_api_transports() => _models.All(model => model.Equals(ModelName.NotSet)).ShouldBeTrue();
}
