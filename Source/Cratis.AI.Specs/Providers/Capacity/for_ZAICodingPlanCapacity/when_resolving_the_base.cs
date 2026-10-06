// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_ZAICodingPlanCapacity;

/// <summary>
/// A provider completes against a path on Z.AI's host; the quota is read from the host itself.
/// </summary>
public class when_resolving_the_base : Specification
{
    [Fact] void should_use_the_configured_endpoints_origin() => ZAICodingPlanCapacity.BaseFor(new AIProviderEndpoint("https://open.bigmodel.cn/api/anthropic")).ShouldEqual("https://open.bigmodel.cn");
    [Fact] void should_default_to_z_ai() => ZAICodingPlanCapacity.BaseFor(AIProviderEndpoint.NotSet).ShouldEqual(ZAICodingPlanCapacity.DefaultBase);
}
