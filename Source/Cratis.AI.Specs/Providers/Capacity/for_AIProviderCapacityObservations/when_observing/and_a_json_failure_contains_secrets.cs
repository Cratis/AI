// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.when_observing;

public class and_a_json_failure_contains_secrets : given.an_observation_cache
{
    AIProviderCapacityObservation _observation;

    void Establish() => _vendor = () => throw new JsonException("sk-secret-vendor-body", new InvalidOperationException("inner-secret"));

    async Task Because() => _observation = await Observe("credential");

    [Fact] void should_expose_only_the_exception_type() => _observation.Report.Problem.ShouldEqual("The usage read failed: JsonException");
    [Fact] void should_return_an_unavailable_observation() => _observation.Report.Source.ShouldEqual(AIProviderCapacitySource.Unknown);
}
