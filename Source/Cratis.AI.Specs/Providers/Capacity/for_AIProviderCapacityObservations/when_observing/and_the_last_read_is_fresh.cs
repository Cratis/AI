// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

/// <summary>
/// Within the freshness window the vendor is not asked again.
/// </summary>
public class and_the_last_read_is_fresh : given.an_observation_cache
{
    AIProviderCapacityObservation _observation;

    async Task Establish() => await Observe();

    async Task Because()
    {
        _timeProvider.Now = _start.AddMinutes(4);
        _observation = await Observe();
    }

    [Fact] void should_ask_the_vendor_once() => _reads.ShouldEqual(1);
    [Fact] void should_serve_when_it_was_observed() => _observation.ObservedAt.ShouldEqual(_start);
}
