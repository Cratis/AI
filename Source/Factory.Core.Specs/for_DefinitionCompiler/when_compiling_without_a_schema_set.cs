// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_compiling_without_a_schema_set : Specification
{
    DefinitionCompilationResult _result = null!;

    void Because() => _result = DefinitionCompiler.Compile(null, new DefinitionsThatMustNotEnumerate(), "workflow");

    [Fact] void should_reject_the_request() => _result.Status.ShouldEqual(DefinitionCompilationStatus.Rejected);
    [Fact] void should_not_enumerate_definitions() => _result.Diagnostics.Single().Code.ShouldEqual(DefinitionDiagnosticCode.SchemaSetRequired);
    [Fact] void should_publish_no_partial_identity() => _result.DefinitionSetIdentity.ShouldBeNull();

    sealed class DefinitionsThatMustNotEnumerate : IEnumerable<DefinitionDocument>
    {
        public IEnumerator<DefinitionDocument> GetEnumerator() => throw new DefinitionsWereEnumerated();
        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
    }

    sealed class DefinitionsWereEnumerated : Exception
    {
        public DefinitionsWereEnumerated()
            : base("Definitions were enumerated.")
        {
        }
    }
}
