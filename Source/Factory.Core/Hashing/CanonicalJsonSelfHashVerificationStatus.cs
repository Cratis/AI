// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Hashing;

/// <summary>
/// Identifies the outcome of verifying a canonical JSON self hash.
/// </summary>
public enum CanonicalJsonSelfHashVerificationStatus
{
    /// <summary>
    /// The declared and calculated identifiers match.
    /// </summary>
    Verified = 0,

    /// <summary>
    /// The canonical root is not an object.
    /// </summary>
    RootNotObject = 1,

    /// <summary>
    /// The selected top-level self-hash member is missing.
    /// </summary>
    Missing = 2,

    /// <summary>
    /// The selected top-level self-hash member is not a strict lowercase SHA-256 identifier.
    /// </summary>
    Malformed = 3,

    /// <summary>
    /// The declared and calculated identifiers differ.
    /// </summary>
    Mismatch = 4
}
