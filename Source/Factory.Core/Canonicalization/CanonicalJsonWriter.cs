// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Text;
using System.Text.Json;

namespace Cratis.Factory.Canonicalization;

static class CanonicalJsonWriter
{
    static readonly UnicodeScalarStringComparer _propertyNameComparer = new();

    public static byte[] Write(JsonElement rootElement)
    {
        var writer = new CappedBufferWriter(CanonicalJsonLimits.MaximumCanonicalBytes);
        WriteValue(writer, rootElement, null);
        return writer.ToArray();
    }

    public static byte[] WriteObjectExcluding(JsonElement rootElement, string excludedProperty)
    {
        var writer = new CappedBufferWriter(CanonicalJsonLimits.MaximumCanonicalBytes);
        WriteObject(writer, rootElement, excludedProperty);
        return writer.ToArray();
    }

    static void WriteValue(CappedBufferWriter writer, JsonElement value, string? excludedTopLevelProperty)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                WriteObject(writer, value, excludedTopLevelProperty);
                break;
            case JsonValueKind.Array:
                WriteArray(writer, value);
                break;
            case JsonValueKind.String:
                WriteString(writer, value.GetString()!);
                break;
            case JsonValueKind.Number:
                var number = value.GetRawText();
                writer.WriteAscii(number == "-0" ? "0" : number);
                break;
            case JsonValueKind.True:
                writer.WriteAscii("true");
                break;
            case JsonValueKind.False:
                writer.WriteAscii("false");
                break;
            case JsonValueKind.Null:
                writer.WriteAscii("null");
                break;
        }
    }

    static void WriteObject(CappedBufferWriter writer, JsonElement value, string? excludedProperty)
    {
        var properties = new List<CanonicalProperty>();
        foreach (var property in value.EnumerateObject())
        {
            if (excludedProperty is null || !string.Equals(property.Name, excludedProperty, StringComparison.Ordinal))
            {
                properties.Add(new(property.Name, property.Value));
            }
        }

        properties.Sort(static (left, right) => _propertyNameComparer.Compare(left.Name, right.Name));
        writer.WriteByte((byte)'{');
        for (var index = 0; index < properties.Count; index++)
        {
            if (index > 0)
            {
                writer.WriteByte((byte)',');
            }

            var property = properties[index];
            WriteString(writer, property.Name);
            writer.WriteByte((byte)':');
            WriteValue(writer, property.Value, null);
        }

        writer.WriteByte((byte)'}');
    }

    static void WriteArray(CappedBufferWriter writer, JsonElement value)
    {
        writer.WriteByte((byte)'[');
        var index = 0;
        foreach (var item in value.EnumerateArray())
        {
            if (index++ > 0)
            {
                writer.WriteByte((byte)',');
            }

            WriteValue(writer, item, null);
        }

        writer.WriteByte((byte)']');
    }

    static void WriteString(CappedBufferWriter writer, string value)
    {
        writer.WriteByte((byte)'"');
        Span<byte> encoded = stackalloc byte[4];
        foreach (var rune in value.EnumerateRunes())
        {
            switch (rune.Value)
            {
                case '"':
                    writer.WriteAscii("\\\"");
                    break;
                case '\\':
                    writer.WriteAscii("\\\\");
                    break;
                case '\b':
                    writer.WriteAscii("\\b");
                    break;
                case '\t':
                    writer.WriteAscii("\\t");
                    break;
                case '\n':
                    writer.WriteAscii("\\n");
                    break;
                case '\f':
                    writer.WriteAscii("\\f");
                    break;
                case '\r':
                    writer.WriteAscii("\\r");
                    break;
                case < 0x20:
                    writer.WriteAscii("\\u00");
                    writer.WriteByte(ToLowerHex(rune.Value >> 4));
                    writer.WriteByte(ToLowerHex(rune.Value & 0xf));
                    break;
                default:
                    var length = rune.EncodeToUtf8(encoded);
                    writer.Write(encoded[..length]);
                    break;
            }
        }

        writer.WriteByte((byte)'"');
    }

    static byte ToLowerHex(int value) => (byte)(value < 10 ? '0' + value : 'a' + value - 10);

    readonly record struct CanonicalProperty(string Name, JsonElement Value);

    sealed class UnicodeScalarStringComparer : IComparer<string>
    {
        public int Compare(string? x, string? y)
        {
            if (ReferenceEquals(x, y))
            {
                return 0;
            }

            if (x is null)
            {
                return -1;
            }

            if (y is null)
            {
                return 1;
            }

            var leftOffset = 0;
            var rightOffset = 0;
            while (leftOffset < x.Length && rightOffset < y.Length)
            {
                var leftRune = Rune.GetRuneAt(x, leftOffset);
                var rightRune = Rune.GetRuneAt(y, rightOffset);
                var comparison = leftRune.Value.CompareTo(rightRune.Value);
                if (comparison != 0)
                {
                    return comparison;
                }

                leftOffset += leftRune.Utf16SequenceLength;
                rightOffset += rightRune.Utf16SequenceLength;
            }

            return (x.Length - leftOffset).CompareTo(y.Length - rightOffset);
        }
    }
}
