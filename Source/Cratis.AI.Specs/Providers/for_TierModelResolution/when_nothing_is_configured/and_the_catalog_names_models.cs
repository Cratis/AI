// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelResolution.when_nothing_is_configured;

/// <summary>
/// With no mapping at all, the tier is answered entirely from what the provider published.
/// </summary>
public class and_the_catalog_names_models : Specification
{
    static readonly ModelName[] _catalog =
    [
        new("glm-5.3-flash"),
        new("glm-5.2"),
        new("glm-5.3")
    ];

    [Fact]
    void should_resolve_to_the_modest_model_in_the_catalog() =>
        TierModelResolution.Resolve(null, _catalog, ModelTier.Fast).ShouldEqual(new ModelName("glm-5.3-flash"));
}
