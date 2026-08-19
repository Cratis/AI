// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Text.Json;

namespace Cratis.Factory.Canonicalization;

/// <summary>
/// Represents an immutable, bounded Factory canonical JSON version 1 value.
/// </summary>
public sealed class CanonicalJsonValue
{
    readonly byte[] _utf8;

    internal CanonicalJsonValue(byte[] utf8, JsonElement rootElement)
    {
        _utf8 = utf8;
        RootElement = rootElement;
    }

    /// <summary>
    /// Gets a read-only view of the exact canonical UTF-8 bytes.
    /// </summary>
    public ReadOnlySpan<byte> Utf8 => _utf8;

    /// <summary>
    /// Gets an owned root element whose lifetime is independent of a disposable document.
    /// </summary>
    public JsonElement RootElement { get; }

    /// <summary>
    /// Creates a defensive copy of the exact canonical UTF-8 bytes.
    /// </summary>
    /// <returns>A new byte array containing the canonical UTF-8 bytes.</returns>
    public byte[] ToArray() => [.. _utf8];

    /// <summary>
    /// Writes the exact canonical UTF-8 bytes to a caller-owned buffer.
    /// </summary>
    /// <param name="destination">The destination buffer.</param>
    public void WriteTo(IBufferWriter<byte> destination) => destination.Write(_utf8);
}
