// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelResolution.when_nothing_is_configured;

public class and_the_vendor_has_defaults : Specification
{
    [Fact]
    void should_resolve_to_the_vendor_default() =>
        TierModelResolution.Resolve(null, AIProviderType.ZAI, ModelTier.Fast).ShouldEqual(new ModelName("glm-5.3-flash"));
}
