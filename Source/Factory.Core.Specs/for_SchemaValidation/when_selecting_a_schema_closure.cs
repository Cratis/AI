// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_selecting_a_schema_closure : Specification
{
    const string SchemaId = "https://schemas.cratis.io/factory/tests/closure-selection.schema.json";
    SchemaResourceSet _resourceSet = null!;
    SchemaClosureResult _resolved = null!;
    SchemaClosureResult _missing = null!;
    SchemaClosureResult _invalid = null!;

    void Because()
    {
        _resourceSet = SchemaResourceSet.Load([
            new SchemaDocument(SchemaId, Encoding.UTF8.GetBytes($$"""
                {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{SchemaId}}","type":"null"}
                """))
        ]).ResourceSet!;
        _resolved = _resourceSet.GetClosure(SchemaId);
        _missing = _resourceSet.GetClosure("https://schemas.cratis.io/factory/tests/absent.schema.json");
        _invalid = _resourceSet.GetClosure(null);
    }

    [Fact] void should_resolve_an_admitted_resource() => _resolved.Status.ShouldEqual(SchemaClosureStatus.Resolved);
    [Fact] void should_return_the_selected_closure() => _resolved.Closure!.RootSchemaId.ShouldEqual(SchemaId);
    [Fact] void should_bind_the_resource_set_identity() => _resolved.SchemaSetIdentity.ShouldEqual(_resourceSet.Identity);
    [Fact] void should_distinguish_an_unadmitted_resource() => _missing.Status.ShouldEqual(SchemaClosureStatus.NotFound);
    [Fact] void should_report_an_unadmitted_resource() => _missing.Diagnostics.Single().Code.ShouldEqual(SchemaDiagnosticCode.SchemaNotFound);
    [Fact] void should_reject_an_invalid_identifier() => _invalid.Status.ShouldEqual(SchemaClosureStatus.Rejected);
    [Fact] void should_report_an_invalid_identifier() => _invalid.Diagnostics.Single().Code.ShouldEqual(SchemaDiagnosticCode.InvalidSchemaId);
}
