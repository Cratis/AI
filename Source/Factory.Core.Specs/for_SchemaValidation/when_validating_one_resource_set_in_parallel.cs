// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_validating_one_resource_set_in_parallel : Specification
{
    const string RootSchemaId = "https://schemas.cratis.io/factory/tests/parallel-root.schema.json";
    const string TargetSchemaId = "https://schemas.cratis.io/factory/tests/parallel-target.schema.json";
    SchemaResourceSet _resourceSet = null!;
    SchemaValidationResult _expectedValid = null!;
    SchemaValidationResult _expectedInvalid = null!;
    SchemaValidationResult[] _results = null!;
    Exception? _exception;
    Sha256Hash _identity;

    void Establish()
    {
        var root = Encoding.UTF8.GetBytes($$"""{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{RootSchemaId}}","$ref":"{{TargetSchemaId}}"}""");
        var target = Encoding.UTF8.GetBytes($$"""{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{TargetSchemaId}}","type":"integer"}""");
        var loadResult = SchemaResourceSet.Load([new(RootSchemaId, root), new(TargetSchemaId, target)]);
        _resourceSet = loadResult.ResourceSet!;
        _identity = _resourceSet.Identity;
        _expectedValid = _resourceSet.Validate(RootSchemaId, "42"u8);
        _expectedInvalid = _resourceSet.Validate(RootSchemaId, "\"secret@example.com\""u8);
    }

    void Because()
    {
        _results = new SchemaValidationResult[512];
        _exception = Catch.Exception(() => Parallel.For(
            0,
            _results.Length,
            index => _results[index] = _resourceSet.Validate(RootSchemaId, index % 2 == 0 ? "42"u8 : "\"secret@example.com\""u8)));
    }

    [Fact] void should_not_throw() => _exception.ShouldBeNull();
    [Fact] void should_preserve_the_resource_set_identity() => _resourceSet.Identity.ShouldEqual(_identity);
    [Fact] void should_return_the_same_valid_projection() => _results.Where((_, index) => index % 2 == 0).All(_ => MateriallyEquals(_, _expectedValid)).ShouldBeTrue();
    [Fact] void should_return_the_same_invalid_projection() => _results.Where((_, index) => index % 2 != 0).All(_ => MateriallyEquals(_, _expectedInvalid)).ShouldBeTrue();

    static bool MateriallyEquals(SchemaValidationResult left, SchemaValidationResult right) =>
        left.Status == right.Status &&
        string.Equals(left.SchemaId, right.SchemaId, StringComparison.Ordinal) &&
        left.SchemaSetIdentity == right.SchemaSetIdentity &&
        MateriallyEquals(left.Closure, right.Closure) &&
        left.Diagnostics.SequenceEqual(right.Diagnostics);

    static bool MateriallyEquals(SchemaClosure? left, SchemaClosure? right) =>
        left is null
            ? right is null
            : right is not null &&
              string.Equals(left.RootSchemaId, right.RootSchemaId, StringComparison.Ordinal) &&
              left.Identity == right.Identity &&
              left.ResourceCount == right.ResourceCount &&
              left.AnchorCount == right.AnchorCount &&
              left.ReferenceCount == right.ReferenceCount &&
              left.Members.SequenceEqual(right.Members);
}
