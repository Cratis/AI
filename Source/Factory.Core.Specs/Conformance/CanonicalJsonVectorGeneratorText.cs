// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Conformance;

static class CanonicalJsonVectorGeneratorText
{
    public static bool TryGetSingleScalarByteLength(string? value, out int byteLength)
    {
        byteLength = 0;
        if (string.IsNullOrEmpty(value) ||
            Rune.DecodeFromUtf16(value, out var scalar, out var consumed) != OperationStatus.Done ||
            consumed != value.Length ||
            !IsJsonStringSafe(scalar))
        {
            return false;
        }

        byteLength = scalar.Utf8SequenceLength;
        return true;
    }

    public static bool TryGetPrefixLengths(string? value, out int scalarCount, out int byteLength)
    {
        scalarCount = 0;
        byteLength = 0;
        if (value is null)
        {
            return false;
        }

        var remaining = value.AsSpan();
        while (!remaining.IsEmpty)
        {
            if (Rune.DecodeFromUtf16(remaining, out var scalar, out var consumed) != OperationStatus.Done ||
                !IsJsonStringSafe(scalar))
            {
                return false;
            }

            scalarCount = checked(scalarCount + 1);
            byteLength = checked(byteLength + scalar.Utf8SequenceLength);
            remaining = remaining[consumed..];
        }

        return true;
    }

    public static bool TryGetBase64DecodedLength(string? value, out int decodedLength)
    {
        decodedLength = 0;
        if (value is null || value.Length % 4 != 0)
        {
            return false;
        }

        if (value.Length == 0)
        {
            return true;
        }

        var padding = value[^1] == '=' ? 1 : 0;
        if (value.Length > 1 && value[^2] == '=')
        {
            padding++;
        }

        var dataLength = value.Length - padding;
        for (var index = 0; index < dataLength; index++)
        {
            if (GetBase64Value(value[index]) < 0)
            {
                return false;
            }
        }

        if (value.AsSpan(0, dataLength).IndexOf('=') >= 0 ||
            (padding == 1 && (GetBase64Value(value[^2]) & 0b11) != 0) ||
            (padding == 2 && (GetBase64Value(value[^3]) & 0b1111) != 0))
        {
            return false;
        }

        var length = checked((value.Length / 4L * 3L) - padding);
        if (length > int.MaxValue)
        {
            return false;
        }

        decodedLength = (int)length;
        return true;
    }

    static bool IsJsonStringSafe(Rune scalar) => scalar.Value >= 0x20 && scalar.Value is not '"' and not '\\';

    static int GetBase64Value(char character) => character switch
    {
        >= 'A' and <= 'Z' => character - 'A',
        >= 'a' and <= 'z' => character - 'a' + 26,
        >= '0' and <= '9' => character - '0' + 52,
        '+' => 62,
        '/' => 63,
        _ => -1
    };
}
