// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

public class and_old_credentials_complete_with_a_failure : given.an_observation_cache
{
    readonly TaskCompletionSource<AIProviderCapacityReport> _pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
    Task<AIProviderCapacityObservation> _oldRead;
    AIProviderCapacityObservation _fresh;

    void Establish() => _oldRead = _observations.Observe(_provider, _ => _pending.Task, "old-account");

    async Task Because()
    {
        var changed = Observe("new-account");
        _pending.SetResult(AIProviderCapacityReport.Unavailable("Old account unavailable"));
        await Task.WhenAll(_oldRead, changed);
        _fresh = await Observe("new-account");
        await Observe("new-account");
    }

    [Fact] void should_not_back_off_the_new_account_due_to_the_old_failure() => _reads.ShouldEqual(1);
    [Fact] void should_serve_the_new_accounts_windows() => _fresh.Report.Windows.ShouldEqual(_goodWindows);
    [Fact] void should_not_retain_the_old_accounts_failure() => _fresh.Report.Failed.ShouldBeFalse();
}
