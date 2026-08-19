// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_reading_the_schema_validation_limits : Specification
{
    [Fact] void should_limit_documents() => SchemaValidationLimits.MaximumDocuments.ShouldEqual(64);
    [Fact] void should_limit_aggregate_schema_bytes() => SchemaValidationLimits.MaximumAggregateSchemaBytes.ShouldEqual(8_000_000);
    [Fact] void should_limit_resources() => SchemaValidationLimits.MaximumResources.ShouldEqual(256);
    [Fact] void should_limit_anchors() => SchemaValidationLimits.MaximumAnchors.ShouldEqual(1_024);
    [Fact] void should_limit_reference_edges() => SchemaValidationLimits.MaximumReferenceEdges.ShouldEqual(512);
    [Fact] void should_limit_reference_depth() => SchemaValidationLimits.MaximumReferenceDepth.ShouldEqual(64);
    [Fact] void should_limit_schema_nodes() => SchemaValidationLimits.MaximumSchemaNodes.ShouldEqual(16_384);
    [Fact] void should_limit_instance_nodes() => SchemaValidationLimits.MaximumInstanceNodes.ShouldEqual(65_536);
    [Fact] void should_limit_evaluation_work() => SchemaValidationLimits.MaximumEvaluationWorkUnits.ShouldEqual(32_767);
    [Fact] void should_limit_diagnostic_instance_nodes() => SchemaValidationLimits.MaximumDiagnosticInstanceNodes.ShouldEqual(4_096);
    [Fact] void should_limit_diagnostic_work() => SchemaValidationLimits.MaximumDiagnosticWorkUnits.ShouldEqual(4_095);
    [Fact] void should_limit_diagnostics() => SchemaValidationLimits.MaximumDiagnostics.ShouldEqual(256);
    [Fact] void should_limit_pattern_scalars() => SchemaValidationLimits.MaximumPatternScalars.ShouldEqual(2_048);
    [Fact] void should_limit_schema_identifier_scalars() => SchemaValidationLimits.MaximumSchemaIdScalars.ShouldEqual(2_048);
    [Fact] void should_limit_reference_scalars() => SchemaValidationLimits.MaximumReferenceScalars.ShouldEqual(2_048);
    [Fact] void should_limit_anchor_scalars() => SchemaValidationLimits.MaximumAnchorScalars.ShouldEqual(256);
}
