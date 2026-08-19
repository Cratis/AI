// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics.CodeAnalysis;
using System.Security.Cryptography;

namespace Cratis.Factory.Hashing;

/// <summary>
/// Represents a strict lowercase SHA-256 identifier with a <c>sha256:</c> prefix.
/// </summary>
public sealed class Sha256Hash : IEquatable<Sha256Hash>
{
    const int DigestLength = 32;
    const int ValueLength = 71;
    const string Prefix = "sha256:";
    readonly byte[] _digest;

    Sha256Hash(byte[] digest)
    {
        _digest = digest;
        Value = $"{Prefix}{Convert.ToHexStringLower(digest)}";
    }

    /// <summary>
    /// Gets the strict lowercase prefixed hash value.
    /// </summary>
    public string Value { get; }

    /// <summary>
    /// Determines whether two SHA-256 identifiers are equal using a fixed-time digest comparison.
    /// </summary>
    /// <param name="left">The first identifier.</param>
    /// <param name="right">The second identifier.</param>
    /// <returns><see langword="true"/> when both identifiers contain the same digest.</returns>
    public static bool operator ==(Sha256Hash? left, Sha256Hash? right) => ReferenceEquals(left, right) || left?.Equals(right) is true;

    /// <summary>
    /// Determines whether two SHA-256 identifiers differ using a fixed-time digest comparison.
    /// </summary>
    /// <param name="left">The first identifier.</param>
    /// <param name="right">The second identifier.</param>
    /// <returns><see langword="true"/> when the identifiers differ.</returns>
    public static bool operator !=(Sha256Hash? left, Sha256Hash? right) => !(left == right);

    /// <summary>
    /// Calculates a SHA-256 identifier over an exact immutable byte sequence.
    /// </summary>
    /// <param name="value">The bytes to hash without canonicalization or projection.</param>
    /// <returns>The calculated SHA-256 identifier.</returns>
    /// <remarks>
    /// A hash proves byte integrity only. It does not prove origin, authorization, or server-issued trust.
    /// Artifact descriptor payload <c>contentHash</c> values use this raw-byte operation, not JSON self hashing.
    /// </remarks>
    public static Sha256Hash Calculate(ReadOnlySpan<byte> value) => new(SHA256.HashData(value));

    /// <summary>
    /// Parses a strict lowercase prefixed SHA-256 identifier.
    /// </summary>
    /// <param name="value">The value to parse.</param>
    /// <returns>The parsed identifier.</returns>
    /// <exception cref="InvalidSha256Hash">Thrown when the value is not a strict lowercase prefixed SHA-256 identifier.</exception>
    public static Sha256Hash Parse(string value)
    {
        if (!TryParse(value, out var hash))
        {
            throw new InvalidSha256Hash();
        }

        return hash;
    }

    /// <summary>
    /// Attempts to parse a strict lowercase prefixed SHA-256 identifier.
    /// </summary>
    /// <param name="value">The value to parse.</param>
    /// <param name="hash">The parsed identifier when parsing succeeds.</param>
    /// <returns><see langword="true"/> when parsing succeeds; otherwise, <see langword="false"/>.</returns>
    public static bool TryParse(string? value, [NotNullWhen(true)] out Sha256Hash? hash)
    {
        if (value is null || value.Length != ValueLength || !value.StartsWith(Prefix, StringComparison.Ordinal))
        {
            hash = null;
            return false;
        }

        foreach (var character in value.AsSpan(Prefix.Length))
        {
            if (character is not (>= '0' and <= '9') and not (>= 'a' and <= 'f'))
            {
                hash = null;
                return false;
            }
        }

        var digest = new byte[DigestLength];
        for (var index = 0; index < digest.Length; index++)
        {
            digest[index] = (byte)((FromLowerHex(value[Prefix.Length + (index * 2)]) << 4) |
                FromLowerHex(value[Prefix.Length + (index * 2) + 1]));
        }

        hash = new(digest);
        return true;
    }

    /// <inheritdoc/>
    public bool Equals(Sha256Hash? other) => other is not null && CryptographicOperations.FixedTimeEquals(_digest, other._digest);

    /// <inheritdoc/>
    public override bool Equals(object? obj) => obj is Sha256Hash other && Equals(other);

    /// <inheritdoc/>
    public override int GetHashCode() => HashCode.Combine(_digest[0], _digest[1], _digest[2], _digest[3]);

    /// <inheritdoc/>
    public override string ToString() => Value;

    static int FromLowerHex(char value) => value <= '9' ? value - '0' : value - 'a' + 10;
}
