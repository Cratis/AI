// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_configured_mapping_leaves_the_tier_unset;

public class and_another_tier_is_mapped : Specification
{
    [Fact]
    void should_resolve_to_the_vendor_default() =>
        TierModelResolution.Resolve(
            new TierModels(
                Fast: new ModelName("configured-fast"),
                Balanced: ModelName.NotSet,
                Powerful: ModelName.NotSet,
                Premier: ModelName.NotSet),
            AIProviderType.Anthropic,
            ModelTier.Balanced).ShouldEqual(new ModelName("claude-sonnet-4-5"));
}
