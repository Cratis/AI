// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Conformance;

namespace Cratis.Factory.for_CanonicalJson;

public class when_loading_a_manifest_with_unknown_members : Specification
{
    Exception _rootError = null!;
    Exception _caseError = null!;
    Exception _expectedError = null!;
    Exception _generatorError = null!;

    void Because()
    {
        _rootError = LoadWithUnknownMember(root => root["unknownRootMember"] = true);
        _caseError = LoadWithUnknownMember(root => FirstCase(root)["unknownCaseMember"] = true);
        _expectedError = LoadWithUnknownMember(root => FirstCase(root)["expected"]!.AsObject()["unknownExpectedMember"] = true);
        _generatorError = LoadWithUnknownMember(root => FirstGenerator(root)["unknownGeneratorMember"] = true);
    }

    [Fact] void should_reject_an_unknown_root_member() => _rootError.ShouldBeOfExactType<JsonException>();
    [Fact] void should_reject_an_unknown_case_member() => _caseError.ShouldBeOfExactType<JsonException>();
    [Fact] void should_reject_an_unknown_expected_member() => _expectedError.ShouldBeOfExactType<JsonException>();
    [Fact] void should_reject_an_unknown_generator_member() => _generatorError.ShouldBeOfExactType<JsonException>();

    static Exception LoadWithUnknownMember(Action<JsonObject> mutate)
    {
        var root = JsonNode.Parse(File.ReadAllBytes(CanonicalJsonVectorManifestLoader.ManifestPath))!.AsObject();
        mutate(root);
        return Cratis.Specifications.Catch.Exception(() => CanonicalJsonVectorManifestLoader.Load(Encoding.UTF8.GetBytes(root.ToJsonString())));
    }

    static JsonObject FirstCase(JsonObject root) => root["cases"]!.AsArray()[0]!.AsObject();

    static JsonObject FirstGenerator(JsonObject root) => root["cases"]!
        .AsArray()
        .Select(_ => _!.AsObject())
        .First(_ => _["generator"] is not null)["generator"]!
        .AsObject();
}
