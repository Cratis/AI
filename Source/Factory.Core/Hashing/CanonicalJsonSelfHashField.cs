// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Hashing;

/// <summary>
/// Identifies the only top-level fields that have defined Factory self-hash semantics.
/// </summary>
public enum CanonicalJsonSelfHashField
{
    /// <summary>
    /// The exact case-sensitive top-level <c>contentHash</c> member.
    /// </summary>
    ContentHash = 0,

    /// <summary>
    /// The exact case-sensitive top-level <c>requestHash</c> member.
    /// </summary>
    RequestHash = 1
}
