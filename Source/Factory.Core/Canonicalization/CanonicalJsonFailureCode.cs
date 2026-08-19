// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Canonicalization;

/// <summary>
/// Identifies a deterministic Factory canonical JSON rejection without reflecting input content.
/// </summary>
public enum CanonicalJsonFailureCode
{
    /// <summary>
    /// The input exceeds the byte limit.
    /// </summary>
    InputTooLarge = 0,

    /// <summary>
    /// The canonical output exceeds the byte limit.
    /// </summary>
    CanonicalOutputTooLarge = 1,

    /// <summary>
    /// The input starts with a UTF-8 byte order mark.
    /// </summary>
    ByteOrderMarkNotAllowed = 2,

    /// <summary>
    /// The input is not well-formed UTF-8.
    /// </summary>
    MalformedUtf8 = 3,

    /// <summary>
    /// The input is not a single well-formed JSON value.
    /// </summary>
    MalformedJson = 4,

    /// <summary>
    /// A decoded string or key contains an invalid Unicode scalar value.
    /// </summary>
    InvalidUnicodeScalar = 5,

    /// <summary>
    /// A decoded string or key exceeds the scalar limit.
    /// </summary>
    StringTooLong = 6,

    /// <summary>
    /// Object or array nesting exceeds the container limit.
    /// </summary>
    NestingTooDeep = 7,

    /// <summary>
    /// Structural punctuation exceeds the document limit.
    /// </summary>
    StructuralTokenLimitExceeded = 8,

    /// <summary>
    /// An array exceeds the item limit.
    /// </summary>
    ArrayItemLimitExceeded = 9,

    /// <summary>
    /// An object exceeds the member limit.
    /// </summary>
    ObjectMemberLimitExceeded = 10,

    /// <summary>
    /// An object repeats a decoded, case-sensitive key.
    /// </summary>
    DuplicateObjectKey = 11,

    /// <summary>
    /// A number uses a fraction or exponent and is outside the integer-only value domain.
    /// </summary>
    UnsupportedNumber = 12,

    /// <summary>
    /// An integer is outside the cross-runtime safe range.
    /// </summary>
    IntegerOutOfRange = 13
}
