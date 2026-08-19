// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_a_schema_document_sequence_fails : Specification
{
    SchemaLoadResult _result = null!;

    void Because() => _result = SchemaResourceSet.Load(ThrowingDocuments());

    [Fact] void should_reject_the_resource_set() => _result.Status.ShouldEqual(SchemaLoadStatus.Rejected);
    [Fact] void should_not_publish_a_partial_resource_set() => _result.ResourceSet.ShouldBeNull();
    [Fact] void should_report_only_a_stable_enumeration_failure() => _result.Diagnostics.Single().Code.ShouldEqual(SchemaDiagnosticCode.SchemaDocumentEnumerationFailed);

    static IEnumerable<SchemaDocument> ThrowingDocuments()
    {
        yield return new("https://schemas.cratis.io/factory/tests/before-enumeration-failure.schema.json", "true"u8);
        throw new InvalidOperationException();
    }
}
