// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections;
using System.Reflection;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityBoundaryCache;

public class when_clearing_unknown_providers : Specification
{
    readonly AIProviderCapacityBoundaryCache _cache = new();

    void Because()
    {
        for (var index = 0; index < 100; index++)
        {
            _cache.Invalidate(AIProviderId.New(), clear: true);
        }
    }

    [Fact] void should_not_allocate_slots_for_unknown_providers() =>
        ((ICollection)typeof(AIProviderCapacityBoundaryCache).GetField("_slots", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(_cache)!).Count.ShouldEqual(0);
}
