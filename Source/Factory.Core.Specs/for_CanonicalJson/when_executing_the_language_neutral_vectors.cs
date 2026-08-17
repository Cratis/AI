// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Conformance;

namespace Cratis.Factory.for_CanonicalJson;

public class when_executing_the_language_neutral_vectors : Specification
{
    CanonicalJsonVectorManifest _manifest = null!;
    IReadOnlyList<string> _failures = null!;

    void Establish() => _manifest = CanonicalJsonVectorManifestLoader.Load();
    void Because() => _failures = CanonicalJsonVectorRunner.Execute(_manifest);

    [Fact] void should_match_every_contractually_material_result() => _failures.ShouldBeEmpty();
}
