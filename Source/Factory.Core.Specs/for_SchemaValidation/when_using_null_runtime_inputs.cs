// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_using_null_runtime_inputs : Specification
{
    SchemaLoadResult _nullDocuments = null!;
    SchemaLoadResult _nullDocument = null!;
    SchemaLoadResult _nullLogicalId = null!;
    SchemaValidationResult _nullValidationId = null!;

    void Because()
    {
        _nullDocuments = SchemaResourceSet.Load(null!);
        _nullDocument = SchemaResourceSet.Load([null!]);
        _nullLogicalId = SchemaResourceSet.Load([new SchemaDocument(null, "true"u8)]);

        var loaded = SchemaResourceSet.Load([
            new SchemaDocument("https://schemas.cratis.io/factory/tests/null-runtime.schema.json", "true"u8)
        ]);
        _nullValidationId = loaded.ResourceSet!.Validate(null, "null"u8);
    }

    [Fact] void should_reject_a_null_document_sequence() => _nullDocuments.Status.ShouldEqual(SchemaLoadStatus.Rejected);
    [Fact] void should_report_no_documents_for_a_null_document_sequence() => _nullDocuments.Diagnostics.Single().Code.ShouldEqual(SchemaDiagnosticCode.NoSchemaDocuments);
    [Fact] void should_reject_a_null_document() => _nullDocument.Status.ShouldEqual(SchemaLoadStatus.Rejected);
    [Fact] void should_report_an_invalid_identifier_for_a_null_document() => _nullDocument.Diagnostics.Single().Code.ShouldEqual(SchemaDiagnosticCode.InvalidSchemaId);
    [Fact] void should_reject_a_null_logical_identifier() => _nullLogicalId.Status.ShouldEqual(SchemaLoadStatus.Rejected);
    [Fact] void should_report_a_null_logical_identifier_without_exposing_it() => _nullLogicalId.Diagnostics.Single().ShouldEqual(new(
        SchemaDiagnosticCode.InvalidSchemaId,
        SchemaDiagnosticSeverity.Error,
        SchemaDiagnosticStatus.Rejected,
        null,
        "#",
        "#"));
    [Fact] void should_reject_a_null_validation_identifier() => _nullValidationId.Status.ShouldEqual(SchemaValidationStatus.Rejected);
    [Fact] void should_return_an_empty_safe_validation_identifier() => _nullValidationId.SchemaId.ShouldEqual(string.Empty);
    [Fact] void should_report_an_invalid_schema_without_exposing_a_null_identifier() => _nullValidationId.Diagnostics.Single().ShouldEqual(new(
        SchemaDiagnosticCode.InvalidSchemaId,
        SchemaDiagnosticSeverity.Error,
        SchemaDiagnosticStatus.Rejected,
        null,
        "#",
        "#"));
}
