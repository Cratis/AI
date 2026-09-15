// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_vendor_has_no_default;

public class and_nothing_is_configured_either : Specification
{
    [Fact]
    void should_resolve_to_not_set() =>
        TierModelResolution.Resolve(TierModels.NotSet, AIProviderType.AzureOpenAI, ModelTier.Premier).ShouldEqual(ModelName.NotSet);
}
