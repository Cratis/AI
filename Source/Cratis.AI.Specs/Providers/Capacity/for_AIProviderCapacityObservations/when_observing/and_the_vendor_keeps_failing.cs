// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

/// <summary>
/// After a failed read the vendor is left alone for a while rather than asked on every dispatch,
/// and the back-off grows while it keeps failing.
/// </summary>
public class and_the_vendor_keeps_failing : given.an_observation_cache
{
    int _readsDuringFirstBackOff;
    int _readsAfterFirstBackOff;
    int _readsDuringSecondBackOff;

    void Establish() => _vendor = () => throw new HttpRequestException("No route to host");

    async Task Because()
    {
        await Observe();

        _timeProvider.Now = _start.AddMinutes(4);
        await Observe();
        _readsDuringFirstBackOff = _reads;

        _timeProvider.Now = _start.AddMinutes(6);
        await Observe();
        _readsAfterFirstBackOff = _reads;

        _timeProvider.Now = _start.AddMinutes(15);
        await Observe();
        _readsDuringSecondBackOff = _reads;
    }

    [Fact] void should_not_ask_again_during_the_first_back_off() => _readsDuringFirstBackOff.ShouldEqual(1);
    [Fact] void should_ask_again_once_the_back_off_has_passed() => _readsAfterFirstBackOff.ShouldEqual(2);
    [Fact] void should_back_off_longer_after_a_second_failure() => _readsDuringSecondBackOff.ShouldEqual(2);
}
