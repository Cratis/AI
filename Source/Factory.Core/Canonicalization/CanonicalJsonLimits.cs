// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Canonicalization;

/// <summary>
/// Defines the inclusive resource limits for Factory canonical JSON version 1.
/// </summary>
public static class CanonicalJsonLimits
{
    /// <summary>
    /// The maximum number of bytes in an input document.
    /// </summary>
    public const int MaximumInputBytes = 2_000_000;

    /// <summary>
    /// The maximum number of bytes in a canonical document.
    /// </summary>
    public const int MaximumCanonicalBytes = 2_000_000;

    /// <summary>
    /// The maximum number of nested object and array containers.
    /// </summary>
    public const int MaximumNestingDepth = 64;

    /// <summary>
    /// The maximum number of Unicode scalar values in one decoded string or object key.
    /// </summary>
    public const int MaximumStringScalars = 1_000_000;

    /// <summary>
    /// The maximum number of structural punctuation tokens outside strings in one document.
    /// </summary>
    public const int MaximumStructuralTokens = 100_000;

    /// <summary>
    /// The maximum number of items in one array.
    /// </summary>
    public const int MaximumArrayItems = 99_999;

    /// <summary>
    /// The maximum number of members in one object.
    /// </summary>
    public const int MaximumObjectMembers = 49_999;

    /// <summary>
    /// The largest integer accepted by the cross-runtime value domain.
    /// </summary>
    public const long MaximumSafeInteger = 9_007_199_254_740_991;
}
