// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.SchemaValidation.Conformance;

namespace Cratis.Factory.for_SchemaValidation;

public class when_loading_a_manifest_with_an_unknown_assertion : Specification
{
    Exception? _exception;

    void Because()
    {
        var root = JsonNode.Parse(File.ReadAllBytes(SchemaValidationVectorManifestLoader.ManifestPath))!.AsObject();
        root["cases"]![0]!["unexpectedAssertion"] = true;
        _exception = Catch.Exception(() => SchemaValidationVectorManifestLoader.Load(JsonSerializer.SerializeToUtf8Bytes(root)));
    }

    [Fact] void should_fail_closed() => _exception.ShouldBeOfExactType<InvalidDataException>();
}
