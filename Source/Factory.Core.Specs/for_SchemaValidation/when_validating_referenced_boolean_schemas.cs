// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_validating_referenced_boolean_schemas : Specification
{
    const string RootId = "https://schemas.cratis.io/factory/tests/referenced-false-root.schema.json";
    const string TargetId = "https://schemas.cratis.io/factory/tests/referenced-false-target.schema.json";
    const string DirectFalseId = "https://schemas.cratis.io/factory/tests/direct-false.schema.json";
    SchemaLoadResult _load = null!;
    SchemaValidationResult _referenced = null!;
    SchemaValidationResult _direct = null!;

    void Because()
    {
        _load = SchemaResourceSet.Load([
            new SchemaDocument(RootId, Encoding.UTF8.GetBytes($$$$"""
                {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{{{RootId}}}}","$ref":"{{{{TargetId}}}}#/$defs/blocked"}
                """)),
            new SchemaDocument(TargetId, Encoding.UTF8.GetBytes($$$$"""
                {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{{{TargetId}}}}","$defs":{"blocked":false}}
                """)),
            new SchemaDocument(DirectFalseId, "false"u8)
        ]);
        _referenced = _load.ResourceSet!.Validate(RootId, "null"u8);
        _direct = _load.ResourceSet.Validate(DirectFalseId, "null"u8);
    }

    [Fact] void should_load_the_boolean_schemas() => _load.Status.ShouldEqual(SchemaLoadStatus.Loaded);
    [Fact] void should_reject_through_the_referenced_false_schema() => _referenced.Status.ShouldEqual(SchemaValidationStatus.Invalid);
    [Fact]
    void should_report_the_referenced_false_schema_code() =>
        _referenced.Diagnostics.Single().Code.ShouldEqual(SchemaDiagnosticCode.FalseSchema);
    [Fact]
    void should_assign_the_referenced_false_schema_to_its_original_resource() =>
        _referenced.Diagnostics.Single().SchemaId.ShouldEqual(TargetId);
    [Fact]
    void should_report_the_referenced_false_schema_original_pointer() =>
        _referenced.Diagnostics.Single().KeywordLocation.StartsWith("#/$defs/", StringComparison.Ordinal).ShouldBeTrue();
    [Fact] void should_reject_a_direct_false_schema() => _direct.Status.ShouldEqual(SchemaValidationStatus.Invalid);
    [Fact] void should_assign_the_direct_false_schema_to_itself() => _direct.Diagnostics.Single().SchemaId.ShouldEqual(DirectFalseId);
    [Fact] void should_report_the_direct_false_schema_code() => _direct.Diagnostics.Single().Code.ShouldEqual(SchemaDiagnosticCode.FalseSchema);
}
