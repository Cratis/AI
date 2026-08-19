// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_validating_rebased_references_with_special_locations : Specification
{
    const string RootId = "https://schemas.cratis.io/factory/tests/rebased/";
    const string FirstId = $"{RootId}first/";
    const string SecondId = $"{RootId}second/";
    const string ChildId = $"{FirstId}child/";
    byte[] _callerBytes = null!;
    byte[] _originalBytes = null!;
    SchemaLoadResult _firstLoad = null!;
    SchemaLoadResult _secondLoad = null!;
    SchemaValidationResult _valid = null!;
    SchemaValidationResult _invalidSpecial = null!;
    SchemaValidationResult _invalidFirstAnchor = null!;
    SchemaValidationResult _invalidSecondAnchor = null!;

    void Establish()
    {
        _callerBytes = Encoding.UTF8.GetBytes("""
            {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"__ROOT__","$defs":{"~/% space\u0001雪":{"type":"integer"},"first":{"$id":"first/","$defs":{"target":{"$anchor":"same","const":"first"},"child":{"$id":"child/","type":"boolean"}}},"second":{"$id":"second/","$defs":{"target":{"$anchor":"same","const":"second"}}}},"type":"object","properties":{"special":{"$ref":"#/$defs/~0~1%25%20space%01%E9%9B%AA"},"first":{"$ref":"first/#same"},"second":{"$ref":"second/#same"},"child":{"$ref":"first/child/"}},"required":["special","first","second","child"],"additionalProperties":false}
            """.Replace("__ROOT__", RootId, StringComparison.Ordinal));
        _originalBytes = [.. _callerBytes];
    }

    void Because()
    {
        var document = new SchemaDocument(RootId, _callerBytes);
        _firstLoad = SchemaResourceSet.Load([document]);
        _secondLoad = SchemaResourceSet.Load([document]);
        var resourceSet = _firstLoad.ResourceSet!;
        _valid = resourceSet.Validate(RootId, "{\"special\":42,\"first\":\"first\",\"second\":\"second\",\"child\":true}"u8);
        _invalidSpecial = resourceSet.Validate(RootId, "{\"special\":\"wrong\",\"first\":\"first\",\"second\":\"second\",\"child\":true}"u8);
        _invalidFirstAnchor = resourceSet.Validate(RootId, "{\"special\":42,\"first\":\"wrong\",\"second\":\"second\",\"child\":true}"u8);
        _invalidSecondAnchor = resourceSet.Validate(RootId, "{\"special\":42,\"first\":\"first\",\"second\":\"wrong\",\"child\":true}"u8);
    }

    [Fact] void should_load_every_relative_resource() => _firstLoad.Status.ShouldEqual(SchemaLoadStatus.Loaded);
    [Fact]
    void should_admit_every_nested_resource_with_its_exact_trailing_slash_identifier() =>
        _firstLoad.ResourceSet!.Resources.Select(_ => _.SchemaId).ShouldContainOnly([RootId, FirstId, SecondId, ChildId]);
    [Fact] void should_resolve_the_special_pointer_and_resource_scoped_anchors() => _valid.Status.ShouldEqual(SchemaValidationStatus.Valid);
    [Fact] void should_apply_the_special_character_pointer_target() => _invalidSpecial.Status.ShouldEqual(SchemaValidationStatus.Invalid);
    [Fact]
    void should_isolate_the_first_named_anchor() =>
        _invalidFirstAnchor.Diagnostics.Any(_ => string.Equals(_.SchemaId, FirstId, StringComparison.Ordinal)).ShouldBeTrue();
    [Fact]
    void should_isolate_the_second_named_anchor() =>
        _invalidSecondAnchor.Diagnostics.Any(_ => string.Equals(_.SchemaId, SecondId, StringComparison.Ordinal)).ShouldBeTrue();
    [Fact] void should_not_mutate_the_caller_bytes() => _callerBytes.AsSpan().SequenceEqual(_originalBytes).ShouldBeTrue();
    [Fact]
    void should_preserve_the_schema_set_identity_for_unchanged_input() =>
        _secondLoad.ResourceSet!.Identity.ShouldEqual(_firstLoad.ResourceSet!.Identity);
    [Fact]
    void should_preserve_the_document_hash_for_unchanged_input() =>
        _secondLoad.ResourceSet!.Documents.ShouldContainOnly(_firstLoad.ResourceSet!.Documents);
    [Fact]
    void should_preserve_the_closure_identity_for_unchanged_input() =>
        _secondLoad.ResourceSet!.GetClosure(RootId).Closure!.Identity.ShouldEqual(_firstLoad.ResourceSet!.GetClosure(RootId).Closure!.Identity);
}
