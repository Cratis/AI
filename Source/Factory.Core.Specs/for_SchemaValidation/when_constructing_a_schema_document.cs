// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_constructing_a_schema_document : Specification
{
    const string SchemaId = "https://schemas.cratis.io/factory/tests/immutable.schema.json";
    byte[] _callerBytes = null!;
    SchemaDocument _document = null!;
    byte[] _returnedBytes = null!;

    void Establish() => _callerBytes = "true"u8.ToArray();

    void Because()
    {
        _document = new(SchemaId, _callerBytes);
        _callerBytes[0] = (byte)'f';
        _returnedBytes = _document.ToArray();
        _returnedBytes[0] = (byte)'f';
    }

    [Fact] void should_defensively_copy_caller_bytes() => _document.Utf8.SequenceEqual("true"u8).ShouldBeTrue();
    [Fact] void should_not_expose_mutable_storage() => _document.ToArray().AsSpan().SequenceEqual("true"u8).ShouldBeTrue();
}
