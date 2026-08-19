// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Factory.Canonicalization;

namespace Cratis.Factory.Hashing;

/// <summary>
/// Calculates and verifies the closed set of Factory top-level JSON self hashes.
/// </summary>
public static class CanonicalJsonSelfHash
{
    /// <summary>
    /// Calculates a self hash after omitting exactly the selected decoded, case-sensitive top-level member.
    /// </summary>
    /// <param name="value">The canonical object to hash.</param>
    /// <param name="field">The self-hash field whose top-level member is omitted.</param>
    /// <returns>The calculated SHA-256 identifier.</returns>
    /// <exception cref="CanonicalJsonSelfHashRequiresObject">Thrown when the canonical root is not an object.</exception>
    /// <remarks>
    /// Nested members with the same name remain part of the hash. A hash proves integrity only; it does not prove
    /// origin, authorization, or server-issued trust. Artifact descriptor payload <c>contentHash</c> values use
    /// raw-byte or whole-value hashing, not this self-hash operation.
    /// </remarks>
    public static Sha256Hash Calculate(CanonicalJsonValue value, CanonicalJsonSelfHashField field)
    {
        if (value.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new CanonicalJsonSelfHashRequiresObject();
        }

        var bytes = CanonicalJsonWriter.WriteObjectExcluding(value.RootElement, GetPropertyName(field));
        return Sha256Hash.Calculate(bytes);
    }

    /// <summary>
    /// Verifies a declared self hash using a fixed-time digest comparison.
    /// </summary>
    /// <param name="value">The canonical value to verify.</param>
    /// <param name="field">The self-hash field whose top-level member is omitted.</param>
    /// <returns>A typed verification outcome.</returns>
    /// <remarks>
    /// Successful verification proves integrity only; it does not prove origin, authorization, or server-issued trust.
    /// </remarks>
    public static CanonicalJsonSelfHashVerification Verify(CanonicalJsonValue value, CanonicalJsonSelfHashField field)
    {
        if (value.RootElement.ValueKind != JsonValueKind.Object)
        {
            return new(CanonicalJsonSelfHashVerificationStatus.RootNotObject);
        }

        var actual = Calculate(value, field);

        if (!value.RootElement.TryGetProperty(GetPropertyName(field), out var declared))
        {
            return new(CanonicalJsonSelfHashVerificationStatus.Missing, Actual: actual);
        }

        if (declared.ValueKind != JsonValueKind.String || !Sha256Hash.TryParse(declared.GetString(), out var expected))
        {
            return new(CanonicalJsonSelfHashVerificationStatus.Malformed, Actual: actual);
        }

        return expected == actual
            ? new(CanonicalJsonSelfHashVerificationStatus.Verified, expected, actual)
            : new(CanonicalJsonSelfHashVerificationStatus.Mismatch, expected, actual);
    }

    static string GetPropertyName(CanonicalJsonSelfHashField field) => field switch
    {
        CanonicalJsonSelfHashField.ContentHash => "contentHash",
        CanonicalJsonSelfHashField.RequestHash => "requestHash",
        _ => throw new InvalidCanonicalJsonSelfHashField()
    };
}
