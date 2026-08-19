// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.SchemaValidation.Conformance;

namespace Cratis.Factory.for_SchemaValidation;

public class when_loading_a_manifest_with_inconsistent_counts : Specification
{
    Exception? _exception;

    void Because()
    {
        var root = JsonNode.Parse(File.ReadAllBytes(SchemaValidationVectorManifestLoader.ManifestPath))!.AsObject();
        var schemaSet = root["cases"]!.AsArray()
            .Select(_ => _!["expected"]!["schemaSet"])
            .First(_ => _ is not null)!
            .AsObject();
        schemaSet["referenceCount"] = schemaSet["referenceCount"]!.GetValue<int>() + 1;
        _exception = Catch.Exception(() => SchemaValidationVectorManifestLoader.Load(JsonSerializer.SerializeToUtf8Bytes(root)));
    }

    [Fact] void should_fail_closed() => _exception.ShouldBeOfExactType<InvalidDataException>();
}
