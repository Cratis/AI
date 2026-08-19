// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Definitions;

/// <summary>
/// Represents one bounded, immutable caller-supplied definition document.
/// </summary>
public sealed class DefinitionDocument
{
    const int MaximumRetainedBytes = 2_000_001;
    readonly byte[] _utf8;

    /// <summary>
    /// Initializes an immutable definition by defensively copying at most the maximum admissible bytes plus one sentinel byte.
    /// </summary>
    /// <param name="logicalId">The caller's logical identifier.</param>
    /// <param name="kind">The exact schema route.</param>
    /// <param name="utf8">The definition as strict UTF-8 JSON.</param>
    public DefinitionDocument(string? logicalId, DefinitionKind kind, ReadOnlySpan<byte> utf8)
    {
        LogicalId = logicalId ?? string.Empty;
        Kind = kind;
        _utf8 = utf8[..Math.Min(utf8.Length, MaximumRetainedBytes)].ToArray();
    }

    /// <summary>
    /// Gets the caller's logical identifier, or an empty value when none was supplied.
    /// </summary>
    public string LogicalId { get; }

    /// <summary>
    /// Gets the exact schema route selected by the caller.
    /// </summary>
    public DefinitionKind Kind { get; }

    /// <summary>
    /// Gets a read-only view of the bounded defensive copy.
    /// </summary>
    public ReadOnlySpan<byte> Utf8 => _utf8;

    /// <summary>
    /// Creates a fresh copy of the retained bytes.
    /// </summary>
    /// <returns>A new byte array.</returns>
    public byte[] ToArray() => [.. _utf8];
}
