// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelResolution.when_resolving_a_configured_tier;

public class and_the_mapping_names_the_tier : Specification
{
    [Fact]
    void should_resolve_the_configured_model() =>
        TierModelResolution.Resolve(
            new TierModels(
                Fast: new ModelName("configured-fast"),
                Balanced: new ModelName("configured-balanced"),
                Powerful: new ModelName("configured-powerful"),
                Premier: new ModelName("configured-premier")),
            [new ModelName("claude-sonnet-4-5")],
            ModelTier.Powerful).ShouldEqual(new ModelName("configured-powerful"));
}
