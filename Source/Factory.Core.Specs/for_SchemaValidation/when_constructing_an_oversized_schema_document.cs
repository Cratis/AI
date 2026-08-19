// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_constructing_an_oversized_schema_document : Specification
{
    SchemaDocument _document = null!;
    SchemaLoadResult _result = null!;

    void Because()
    {
        var callerBytes = new byte[CanonicalJsonLimits.MaximumInputBytes + 100];
        _document = new("https://schemas.cratis.io/factory/tests/oversized.schema.json", callerBytes);
        _result = SchemaResourceSet.Load([_document]);
    }

    [Fact] void should_retain_only_the_bounded_rejection_sentinel() => _document.Utf8.Length.ShouldEqual(CanonicalJsonLimits.MaximumInputBytes + 1);
    [Fact] void should_reject_the_document() => _result.Status.ShouldEqual(SchemaLoadStatus.Rejected);
    [Fact] void should_report_the_canonical_input_limit() => _result.Diagnostics.Single().Code.ShouldEqual(SchemaDiagnosticCode.CanonicalInputTooLarge);
}
