// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

/// <summary>
/// Past the freshness window the vendor is asked again.
/// </summary>
public class and_the_last_read_has_gone_stale : given.an_observation_cache
{
    AIProviderCapacityObservation _observation;

    async Task Establish() => await Observe();

    async Task Because()
    {
        _timeProvider.Now = _start.AddMinutes(6);
        _observation = await Observe();
    }

    [Fact] void should_ask_the_vendor_again() => _reads.ShouldEqual(2);
    [Fact] void should_serve_the_new_observation() => _observation.ObservedAt.ShouldEqual(_start.AddMinutes(6));
}
