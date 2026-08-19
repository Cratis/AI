// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.SchemaValidation.Conformance;

namespace Cratis.Factory.for_SchemaValidation;

public class when_executing_the_language_neutral_vectors : Specification
{
    IReadOnlyList<string> _failures = null!;

    void Because() => _failures = SchemaValidationVectorRunner.Execute(SchemaValidationVectorManifestLoader.Load());

    [Fact] void should_match_every_material_result_repeatedly_and_in_parallel() => _failures.ShouldBeEmpty();
}
