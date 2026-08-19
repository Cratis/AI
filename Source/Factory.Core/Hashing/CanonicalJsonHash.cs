// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Canonicalization;

namespace Cratis.Factory.Hashing;

/// <summary>
/// Calculates whole-value integrity identifiers over exact canonical JSON bytes.
/// </summary>
public static class CanonicalJsonHash
{
    /// <summary>
    /// Calculates an integrity identifier over the entire canonical value without omitting any field.
    /// </summary>
    /// <param name="value">The canonical value to hash.</param>
    /// <returns>The whole-value SHA-256 identifier.</returns>
    /// <remarks>
    /// A hash proves byte integrity only. It does not prove origin, authorization, or server-issued trust.
    /// Artifact descriptor payload <c>contentHash</c> values use whole-value or raw-byte hashing, not JSON self hashing.
    /// </remarks>
    public static Sha256Hash Calculate(CanonicalJsonValue value) => Sha256Hash.Calculate(value.Utf8);
}
