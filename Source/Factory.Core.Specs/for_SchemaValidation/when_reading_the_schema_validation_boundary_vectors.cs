// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.SchemaValidation.Conformance;

namespace Cratis.Factory.for_SchemaValidation;

public class when_reading_the_schema_validation_boundary_vectors : Specification
{
    IReadOnlyDictionary<string, SchemaValidationVector> _vectors = null!;

    void Because() => _vectors = SchemaValidationVectorManifestLoader.Load().Cases.ToDictionary(_ => _.Id, StringComparer.Ordinal);

    [Fact] void should_bind_reference_edge_maximum_and_maximum_plus_one() => Counts("maximum-reference-edges", "maximum-plus-one-reference-edges").ShouldEqual((512, 513));
    [Fact] void should_bind_reference_depth_maximum_and_maximum_plus_one() => Counts("maximum-reference-depth", "maximum-plus-one-reference-depth").ShouldEqual((64, 65));
    [Fact] void should_bind_schema_node_maximum_and_maximum_plus_one() => Counts("maximum-schema-nodes", "maximum-plus-one-schema-nodes").ShouldEqual((16_384, 16_385));
    [Fact] void should_bind_instance_node_maximum_and_maximum_plus_one() => InstanceCounts("maximum-instance-nodes", "maximum-plus-one-instance-nodes").ShouldEqual((65_536, 65_537));
    [Fact] void should_bind_evaluation_work_maximum_and_maximum_plus_one() => WorkUnits("maximum-evaluation-work-units", "maximum-plus-one-evaluation-work-units").ShouldEqual((32_767L, 32_768L));
    [Fact] void should_bind_diagnostic_instance_node_maximum_and_maximum_plus_one() => InstanceCounts("maximum-diagnostic-instance-nodes", "maximum-plus-one-diagnostic-instance-nodes").ShouldEqual((4_096, 4_097));
    [Fact] void should_bind_diagnostic_work_maximum_and_maximum_plus_one() => WorkUnits("maximum-diagnostic-work-units", "maximum-plus-one-diagnostic-work-units").ShouldEqual((4_095L, 4_096L));

    (int Maximum, int MaximumPlusOne) Counts(string maximum, string maximumPlusOne) =>
        (_vectors[maximum].SchemaGenerator!.Count, _vectors[maximumPlusOne].SchemaGenerator!.Count);

    (int Maximum, int MaximumPlusOne) InstanceCounts(string maximum, string maximumPlusOne) =>
        (_vectors[maximum].InstanceGenerator!.Count, _vectors[maximumPlusOne].InstanceGenerator!.Count);

    (long Maximum, long MaximumPlusOne) WorkUnits(string maximum, string maximumPlusOne) =>
        (WorkUnits(_vectors[maximum]), WorkUnits(_vectors[maximumPlusOne]));

    static long WorkUnits(SchemaValidationVector vector)
    {
        var layers = vector.SchemaGenerator!.Count;
        var basePathWork = (1L << (layers + 2)) - 3;
        var canonicalStringBytes = vector.InstanceGenerator!.Count +
                                   (string.Equals(vector.InstanceGenerator.Kind, "patternAdversarialInput", StringComparison.Ordinal) ? 3 : 2);
        return basePathWork + ((canonicalStringBytes + 63) / 64);
    }
}
