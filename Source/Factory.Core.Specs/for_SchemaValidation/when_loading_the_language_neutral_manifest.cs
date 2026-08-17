// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.SchemaValidation.Conformance;

namespace Cratis.Factory.for_SchemaValidation;

public class when_loading_the_language_neutral_manifest : Specification
{
    SchemaValidationVectorManifest _manifest = null!;

    void Because() => _manifest = SchemaValidationVectorManifestLoader.Load();

    [Fact] void should_load_all_exact_byte_documents() => _manifest.Documents.Count.ShouldEqual(63);
    [Fact] void should_load_all_contract_cases() => _manifest.Cases.Count.ShouldEqual(135);
    [Fact] void should_bind_every_generator() => _manifest.GeneratorContract.Count.ShouldEqual(24);
}
