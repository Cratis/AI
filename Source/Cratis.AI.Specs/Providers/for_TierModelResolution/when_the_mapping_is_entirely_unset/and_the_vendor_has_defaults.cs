// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_mapping_is_entirely_unset;

public class and_the_vendor_has_defaults : Specification
{
    [Fact]
    void should_resolve_to_the_vendor_default() =>
        TierModelResolution.Resolve(TierModels.NotSet, AIProviderType.OpenAI, ModelTier.Fast).ShouldEqual(new ModelName("gpt-5-mini"));
}
