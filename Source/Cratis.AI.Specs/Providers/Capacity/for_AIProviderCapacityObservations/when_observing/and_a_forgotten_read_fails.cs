// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

public class and_a_forgotten_read_fails : given.an_observation_cache
{
    TaskCompletionSource<AIProviderCapacityReport> _pending;
    Task<AIProviderCapacityObservation> _read;
    AIProviderCapacityObservation _completed;
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
        _pending.SetException(new HttpRequestException("secret-vendor-response"));
        _completed = await _read;
        _boundary = _observations.Boundaries.Read(_provider);
        _fresh = await Observe("credential");
    }

    [Fact] void should_return_the_failure_to_its_original_caller() => _completed.Report.Source.ShouldEqual(AIProviderCapacitySource.Unknown);
    [Fact] void should_not_publish_the_late_failure_at_the_boundary() => _boundary.ShouldBeNull();
    [Fact] void should_not_apply_backoff_from_the_forgotten_failure() => _reads.ShouldEqual(1);
    [Fact] void should_serve_the_new_read() => _fresh.Report.Windows.ShouldEqual(_goodWindows);
}
