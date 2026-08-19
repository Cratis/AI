// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_loading_the_compile_time_native_schema_set : given_an_accepted_definition_schema_set
{
    IReadOnlyList<SchemaDocument> _first = null!;
    IReadOnlyList<SchemaDocument> _second = null!;
    int _resolvedRouteCount;

    void Because()
    {
        _first = NativeDefinitionCompilerInputs.SchemaDocuments();
        _second = NativeDefinitionCompilerInputs.SchemaDocuments();
        _first[0].ToArray()[0] ^= 0xff;
        _resolvedRouteCount = Enum.GetValues<DefinitionKind>()
            .Count(IsResolvedRoute);
    }

    [Fact] void should_construct_all_schemas_from_compile_time_caller_bytes() => _first.Count.ShouldEqual(29);
    [Fact] void should_return_fresh_schema_documents() => ReferenceEquals(_first, _second).ShouldBeFalse();
    [Fact] void should_return_fresh_schema_document_values() => ReferenceEquals(_first[0], _second[0]).ShouldBeFalse();
    [Fact] void should_return_fresh_schema_bytes() => _first[0].Utf8.SequenceEqual(_second[0].Utf8).ShouldBeTrue();
    [Fact] void should_resolve_every_definition_route_from_the_in_memory_set() => _resolvedRouteCount.ShouldEqual(13);

    bool IsResolvedRoute(DefinitionKind kind)
    {
        return DefinitionCompiler.TryGetSchemaId(kind, out var schemaId) &&
            Schemas.GetClosure(schemaId).Status is SchemaClosureStatus.Resolved;
    }
}
