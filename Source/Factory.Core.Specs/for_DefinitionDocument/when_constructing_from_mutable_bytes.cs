// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;

namespace Cratis.Factory.for_DefinitionDocument;

public class when_constructing_from_mutable_bytes : Specification
{
    byte[] _callerBytes = null!;
    DefinitionDocument _document = null!;
    byte[] _firstCopy = null!;

    void Establish() => _callerBytes = [1, 2, 3];

    void Because()
    {
        _document = new(null, DefinitionKind.Workflow, _callerBytes);
        _callerBytes[0] = 9;
        _firstCopy = _document.ToArray();
        _firstCopy[1] = 9;
    }

    [Fact] void should_normalize_a_null_logical_id() => _document.LogicalId.ShouldEqual(string.Empty);
    [Fact] void should_defensively_copy_the_caller_bytes() => _document.Utf8[0].ShouldEqual((byte)1);
    [Fact] void should_return_a_fresh_copy() => _document.Utf8[1].ShouldEqual((byte)2);
}
