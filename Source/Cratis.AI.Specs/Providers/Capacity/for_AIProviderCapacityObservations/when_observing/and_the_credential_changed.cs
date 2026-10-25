// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

/// <summary>
/// A new credential can reach another account, so what the old one saw is not served for it.
/// </summary>
public class and_the_credential_changed : given.an_observation_cache
{
    async Task Establish() => await Observe("old");

    async Task Because()
    {
        _timeProvider.Now = _start.AddMinutes(1);
        await Observe("new");
    }

    [Fact] void should_ask_the_vendor_again() => _reads.ShouldEqual(2);
}
