// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Canonicalization;

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Represents caller-supplied schema bytes under an explicit language-neutral logical identifier.
/// </summary>
public sealed class SchemaDocument
{
    readonly byte[] _utf8;

    /// <summary>
    /// Initializes an immutable schema document by defensively copying caller-owned bytes up to the
    /// canonical input maximum plus one byte. The retained maximum-plus-one sentinel preserves an
    /// exact typed oversized-document rejection without retaining an unbounded caller buffer.
    /// </summary>
    /// <param name="logicalId">The absolute logical schema identifier.</param>
    /// <param name="utf8">The schema document as strict UTF-8 JSON.</param>
    public SchemaDocument(string? logicalId, ReadOnlySpan<byte> utf8)
    {
        LogicalId = logicalId ?? string.Empty;
        var retainedLength = Math.Min(utf8.Length, CanonicalJsonLimits.MaximumInputBytes + 1);
        _utf8 = utf8[..retainedLength].ToArray();
    }

    /// <summary>
    /// Gets the exact caller-supplied logical identifier.
    /// </summary>
    public string LogicalId { get; }

    /// <summary>
    /// Gets a read-only view of the bounded defensive copy of the schema bytes.
    /// </summary>
    public ReadOnlySpan<byte> Utf8 => _utf8;

    /// <summary>
    /// Creates a copy of the bounded retained schema bytes.
    /// </summary>
    /// <returns>A new byte array containing the schema bytes.</returns>
    public byte[] ToArray() => [.. _utf8];
}
