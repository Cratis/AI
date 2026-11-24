// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

public class and_old_credentials_complete_successfully : given.an_observation_cache
{
    readonly TaskCompletionSource<AIProviderCapacityReport> _pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
    Task<AIProviderCapacityObservation> _oldRead;
    AIProviderCapacityObservation _fresh;

    void Establish() => _oldRead = _observations.Observe(_provider, _ => _pending.Task, "old-account");

    async Task Because()
    {
        var changed = Observe("new-account");
        _pending.SetResult(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "old-account", 0.1, null)]));
        await Task.WhenAll(_oldRead, changed);
        _fresh = await Observe("new-account");
        await Observe("new-account");
    }

    [Fact] void should_read_the_new_account_instead_of_caching_the_old_result() => _reads.ShouldEqual(1);
    [Fact] void should_serve_the_new_accounts_windows() => _fresh.Report.Windows.ShouldEqual(_goodWindows);
}
