// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

public class and_the_same_credentials_share_a_read : given.an_observation_cache
{
    readonly TaskCompletionSource<AIProviderCapacityReport> _pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
    Task<AIProviderCapacityObservation> _firstRead;
    AIProviderCapacityObservation _cached;

    void Establish() => _firstRead = _observations.Observe(_provider, _ => _pending.Task, "same-account");

    async Task Because()
    {
        var shared = Observe("same-account");
        _pending.SetResult(AIProviderCapacityReport.Subscription(_goodWindows));
        await Task.WhenAll(_firstRead, shared);
        _cached = await Observe("same-account");
    }

    [Fact] void should_not_read_the_vendor_again() => _reads.ShouldEqual(0);
    [Fact] void should_cache_the_shared_result() => _cached.Report.Windows.ShouldEqual(_goodWindows);
}
