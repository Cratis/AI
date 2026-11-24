// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

public class and_credentials_change_back_during_a_read : given.an_observation_cache
{
    TaskCompletionSource<AIProviderCapacityReport> _pending;
    Task<AIProviderCapacityObservation> _read;
    AIProviderCapacityObservation _fresh;

    void Establish()
    {
        _pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
        _read = _observations.Observe(_provider, _ => _pending.Task, "original-credential");
    }

    async Task Because()
    {
        var changed = Observe("different-credential");
        var changedBack = Observe("original-credential");
        _pending.SetResult(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "old-generation", 0.1, null)]));
        await Task.WhenAll(_read, changed, changedBack);
        _fresh = await Observe("original-credential");
    }

    [Fact] void should_not_cache_a_read_from_the_original_generation() => _reads.ShouldEqual(1);
    [Fact] void should_read_the_account_again() => _fresh.Report.Windows.ShouldEqual(_goodWindows);
}
