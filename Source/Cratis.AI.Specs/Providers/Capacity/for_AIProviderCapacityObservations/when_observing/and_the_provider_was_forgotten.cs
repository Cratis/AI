// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

/// <summary>
/// A provider that has just turned work away is read again on the next ask, fresh or not.
/// </summary>
public class and_the_provider_was_forgotten : given.an_observation_cache
{
    async Task Establish()
    {
        await Observe();
        _observations.Forget(_provider);
    }

    async Task Because()
    {
        _timeProvider.Now = _start.AddMinutes(1);
        await Observe();
    }

    [Fact] void should_ask_the_vendor_again() => _reads.ShouldEqual(2);
}
