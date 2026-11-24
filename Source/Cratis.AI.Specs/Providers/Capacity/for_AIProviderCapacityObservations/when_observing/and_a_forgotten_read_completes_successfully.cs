// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

public class and_a_forgotten_read_completes_successfully : given.an_observation_cache
{
    TaskCompletionSource<AIProviderCapacityReport> _pending;
    Task<AIProviderCapacityObservation> _read;
    AIProviderCapacityObservation _completed;
    AIProviderCapacityObservation _joined;
    AIProviderCapacityObservation _fresh;
    AIProviderCapacityBoundaryCache.Cached _boundary;

    void Establish()
    {
        _pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
        _read = _observations.Observe(_provider, _ => _pending.Task, "credential");
    }

    async Task Because()
    {
        _observations.Forget(_provider);
        var joined = Observe("credential");
        _pending.SetResult(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "forgotten", 0.1, null)]));
        _completed = await _read;
        _joined = await joined;
        _boundary = _observations.Boundaries.Read(_provider);
        _fresh = await Observe("credential");
    }

    [Fact] void should_return_the_completed_read_to_its_original_caller() => _completed.Report.Windows.Single().Name.ShouldEqual("forgotten");
    [Fact] void should_keep_the_existing_single_flight_join() => _joined.ShouldEqual(_completed);
    [Fact] void should_not_publish_the_forgotten_read_at_the_boundary() => _boundary.ShouldBeNull();
    [Fact] void should_read_again_instead_of_caching_the_late_result() => _reads.ShouldEqual(1);
    [Fact] void should_serve_the_new_read() => _fresh.Report.Windows.ShouldEqual(_goodWindows);
}
