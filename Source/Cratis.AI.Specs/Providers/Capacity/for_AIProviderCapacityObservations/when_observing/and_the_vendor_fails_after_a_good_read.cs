// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

/// <summary>
/// A vendor that stops answering - the Claude usage endpoint answers 429 readily - leaves the last
/// good figures in service, marked with when they were observed and why they are stale.
/// </summary>
public class and_the_vendor_fails_after_a_good_read : given.an_observation_cache
{
    AIProviderCapacityObservation _observation;

    async Task Establish()
    {
        await Observe();
        _vendor = () => AIProviderCapacityReport.Unavailable("Claude rate limited the usage read");
    }

    async Task Because()
    {
        _timeProvider.Now = _start.AddMinutes(6);
        _observation = await Observe();
    }

    [Fact] void should_serve_the_last_good_windows() => _observation.Report.Windows.ShouldEqual(_goodWindows);
    [Fact] void should_keep_the_last_good_source() => _observation.Report.Source.ShouldEqual(AIProviderCapacitySource.Subscription);
    [Fact] void should_say_when_the_figures_were_observed() => _observation.ObservedAt.ShouldEqual(_start);
    [Fact] void should_say_why_they_are_stale() => _observation.Report.Problem.ShouldEqual("Claude rate limited the usage read");
}
