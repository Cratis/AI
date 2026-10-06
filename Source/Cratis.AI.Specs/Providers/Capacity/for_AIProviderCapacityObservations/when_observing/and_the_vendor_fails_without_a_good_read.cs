// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

/// <summary>
/// With nothing good to fall back on, the failure itself is served as an unknown capacity.
/// </summary>
public class and_the_vendor_fails_without_a_good_read : given.an_observation_cache
{
    AIProviderCapacityObservation _observation;

    void Establish() => _vendor = () => throw new HttpRequestException("No route to host");

    async Task Because() => _observation = await Observe();

    [Fact] void should_serve_an_unknown_capacity() => _observation.Report.Source.ShouldEqual(AIProviderCapacitySource.Unknown);
    [Fact] void should_say_why() => _observation.Report.Problem.ShouldEqual("The usage read failed: No route to host");
}
