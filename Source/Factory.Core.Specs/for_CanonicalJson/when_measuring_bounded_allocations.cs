// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Conformance;

namespace Cratis.Factory.for_CanonicalJson;

public class when_measuring_bounded_allocations : Specification
{
    CanonicalJsonVectorManifest _manifest = null!;
    IReadOnlyList<string> _failures = null!;

    void Establish() => _manifest = CanonicalJsonVectorManifestLoader.Load();
    void Because() => _failures = CanonicalJsonAllocationMeasurements.Measure(_manifest);

    [Fact] void should_stay_within_the_vector_ceiling_after_warmup() => _failures.ShouldBeEmpty();
}
