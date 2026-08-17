// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;
using System.Text;
using Cratis.Factory.Canonicalization;

namespace Cratis.Factory.CanonicalJsonParity;

static class VectorInputGenerator
{
    const int GeneratorAllowance = 1;
    const int MaximumGeneratedBytes = CanonicalJsonLimits.MaximumInputBytes + GeneratorAllowance;

    public static bool IsValid(VectorCase vector) => TryGetInputLength(vector, out _);

    public static byte[] Generate(VectorCase vector)
    {
        if (!TryGetInputLength(vector, out var exactLength))
        {
            throw new InvalidVectorManifest();
        }

        if (vector.InputBase64 is not null)
        {
            var decoded = Convert.FromBase64String(vector.InputBase64);
            return decoded.Length == exactLength ? decoded : throw new InvalidVectorManifest();
        }

        return Generate(vector.Generator!, exactLength);
    }

    static bool TryGetInputLength(VectorCase vector, out int exactLength)
    {
        exactLength = 0;
        if ((vector.InputBase64 is null) == (vector.Generator is null))
        {
            return false;
        }

        if (vector.InputBase64 is not null)
        {
            return TryGetBase64DecodedLength(vector.InputBase64, out exactLength) &&
                   exactLength <= CanonicalJsonLimits.MaximumInputBytes;
        }

        return TryGetGeneratedLength(vector, vector.Generator!, out exactLength) &&
               (exactLength <= CanonicalJsonLimits.MaximumInputBytes || IsExplicitInputLimitPlusOne(vector, exactLength));
    }

    static bool TryGetGeneratedLength(VectorCase vector, VectorGenerator generator, out int exactLength)
    {
        exactLength = 0;
        switch (generator.Kind)
        {
            case "repeatedString":
                return Only(generator, nameof(generator.Scalar), nameof(generator.ScalarCount)) &&
                       TryGetEncodedScalarLength(generator.Scalar, out var repeatedScalarBytes) &&
                       IsWithinLimitOrExplicitRejection(
                           generator.ScalarCount,
                           CanonicalJsonLimits.MaximumStringScalars,
                           vector,
                           CanonicalJsonFailureCode.StringTooLong,
                           "stringScalars") &&
                       TrySetLength(2L + ((long)repeatedScalarBytes * generator.ScalarCount!.Value), out exactLength);
            case "singlePropertyObject":
                return Only(generator, nameof(generator.KeyScalar), nameof(generator.KeyScalarCount)) &&
                       TryGetEncodedScalarLength(generator.KeyScalar, out var keyScalarBytes) &&
                       IsWithinLimitOrExplicitRejection(
                           generator.KeyScalarCount,
                           CanonicalJsonLimits.MaximumStringScalars,
                           vector,
                           CanonicalJsonFailureCode.StringTooLong,
                           "keyScalars") &&
                       TrySetLength(9L + ((long)keyScalarBytes * generator.KeyScalarCount!.Value), out exactLength);
            case "arrayOfNulls":
                return Only(generator, nameof(generator.Count)) &&
                       IsWithinLimitOrExplicitRejection(
                           generator.Count,
                           CanonicalJsonLimits.MaximumArrayItems,
                           vector,
                           CanonicalJsonFailureCode.ArrayItemLimitExceeded,
                           "arrayItems") &&
                       TryGetArrayLength(generator.Count!.Value, false, out exactLength);
            case "arrayWithOneEmptyArrayItem":
                return Only(generator, nameof(generator.Count)) &&
                       IsWithinLimitOrExplicitRejection(
                           generator.Count,
                           CanonicalJsonLimits.MaximumArrayItems,
                           vector,
                           CanonicalJsonFailureCode.ArrayItemLimitExceeded,
                           "arrayItems") &&
                       TryGetArrayLength(generator.Count!.Value, true, out exactLength);
            case "objectWithNullMembers":
                return Only(generator, nameof(generator.Count), nameof(generator.KeyPrefix), nameof(generator.KeyDigits)) &&
                       TryGetObjectLength(vector, generator, false, out exactLength);
            case "objectWithOneEmptyObjectMember":
                return Only(generator, nameof(generator.Count), nameof(generator.KeyPrefix), nameof(generator.KeyDigits)) &&
                       TryGetObjectLength(vector, generator, true, out exactLength);
            case "nestedArrays":
                return Only(generator, nameof(generator.Depth)) &&
                       IsWithinLimitOrExplicitRejection(
                           generator.Depth,
                           CanonicalJsonLimits.MaximumNestingDepth,
                           vector,
                           CanonicalJsonFailureCode.NestingTooDeep,
                           "depth") &&
                       TrySetLength(4L + (2L * generator.Depth!.Value), out exactLength);
            case "paddedValue":
                return Only(generator, nameof(generator.LeadingWhitespaceCount), nameof(generator.ValueBase64)) &&
                       generator.LeadingWhitespaceCount is >= 0 and <= MaximumGeneratedBytes &&
                       generator.ValueBase64 is not null &&
                       TryGetBase64DecodedLength(generator.ValueBase64, out var valueLength) &&
                       TrySetLength((long)generator.LeadingWhitespaceCount.Value + valueLength, out exactLength);
            case "twoStringObject":
                return Only(
                           generator,
                           nameof(generator.AScalar),
                           nameof(generator.AScalarCount),
                           nameof(generator.BScalar),
                           nameof(generator.BScalarCount)) &&
                       TryGetEncodedScalarLength(generator.AScalar, out var aScalarBytes) &&
                       TryGetEncodedScalarLength(generator.BScalar, out var bScalarBytes) &&
                       IsWithinLimitOrExplicitRejection(
                           generator.AScalarCount,
                           CanonicalJsonLimits.MaximumStringScalars,
                           vector,
                           CanonicalJsonFailureCode.StringTooLong,
                           "stringScalars") &&
                       IsWithinLimitOrExplicitRejection(
                           generator.BScalarCount,
                           CanonicalJsonLimits.MaximumStringScalars,
                           vector,
                           CanonicalJsonFailureCode.StringTooLong,
                           "stringScalars") &&
                       TrySetLength(
                           15L +
                           ((long)aScalarBytes * generator.AScalarCount!.Value) +
                           ((long)bScalarBytes * generator.BScalarCount!.Value),
                           out exactLength);
            case "selfHashObject":
                return Only(
                           generator,
                           nameof(generator.HashField),
                           nameof(generator.PayloadScalar),
                           nameof(generator.PayloadScalarCount)) &&
                       (string.Equals(generator.HashField, "contentHash", StringComparison.Ordinal) ||
                        string.Equals(generator.HashField, "requestHash", StringComparison.Ordinal)) &&
                       string.Equals(generator.HashField, vector.Operation, StringComparison.Ordinal) &&
                       string.Equals(vector.Mode, "calculate", StringComparison.Ordinal) &&
                       TryGetEncodedScalarLength(generator.PayloadScalar, out var payloadScalarBytes) &&
                       IsWithinLimitOrExplicitRejection(
                           generator.PayloadScalarCount,
                           CanonicalJsonLimits.MaximumStringScalars,
                           vector,
                           CanonicalJsonFailureCode.StringTooLong,
                           "stringScalars") &&
                       TrySetLength(
                           14L + ((long)payloadScalarBytes * generator.PayloadScalarCount!.Value),
                           out exactLength);
            default:
                return false;
        }
    }

    static bool TryGetObjectLength(VectorCase vector, VectorGenerator generator, bool firstMemberIsEmptyObject, out int exactLength)
    {
        exactLength = 0;
        var keyDigits = generator.KeyDigits.GetValueOrDefault();
        if (!IsWithinLimitOrExplicitRejection(
                generator.Count,
                CanonicalJsonLimits.MaximumObjectMembers,
                vector,
                CanonicalJsonFailureCode.ObjectMemberLimitExceeded,
                "objectMembers") ||
            !generator.KeyDigits.HasValue ||
            keyDigits is < 1 or > 10 ||
            generator.KeyPrefix is null ||
            !TryGetSafePrefix(generator.KeyPrefix, out var prefixScalars, out var prefixBytes) ||
            prefixScalars + keyDigits > CanonicalJsonLimits.MaximumStringScalars)
        {
            return false;
        }

        var count = generator.Count!.Value;
        var keyCapacity = PowerOfTen(keyDigits);
        if (count > keyCapacity)
        {
            return false;
        }

        var memberCount = (long)count;
        var commas = count > 0 ? memberCount - 1 : 0;
        var emptyObjectSaving = firstMemberIsEmptyObject && count > 0 ? 2 : 0;
        return TrySetLength(
            2L +
            (memberCount * (prefixBytes + keyDigits + 7L)) +
            commas -
            emptyObjectSaving,
            out exactLength);
    }

    static bool IsWithinLimitOrExplicitRejection(
        int? value,
        int maximum,
        VectorCase vector,
        CanonicalJsonFailureCode failure,
        string boundaryFlag)
    {
        if (value is >= 0 && value <= maximum)
        {
            return true;
        }

        return value == maximum + 1 &&
               vector.Expected?.Accepted == false &&
               string.Equals(vector.Expected.ErrorCode, failure.ToString(), StringComparison.Ordinal) &&
               HasFlag(vector, boundaryFlag) &&
               HasFlag(vector, "boundary") &&
               HasFlag(vector, "rejected");
    }

    static bool IsExplicitInputLimitPlusOne(VectorCase vector, int exactLength) =>
        exactLength == MaximumGeneratedBytes &&
        string.Equals(vector.Generator?.Kind, "paddedValue", StringComparison.Ordinal) &&
        vector.Expected?.Accepted == false &&
        string.Equals(vector.Expected.ErrorCode, nameof(CanonicalJsonFailureCode.InputTooLarge), StringComparison.Ordinal) &&
        HasFlag(vector, "inputBytes") &&
        HasFlag(vector, "boundary") &&
        HasFlag(vector, "rejected");

    static bool HasFlag(VectorCase vector, string flag) => vector.Flags?.Contains(flag, StringComparer.Ordinal) == true;

    static bool TryGetEncodedScalarLength(string? value, out int byteLength)
    {
        byteLength = 0;
        if (string.IsNullOrEmpty(value) ||
            !Rune.TryGetRuneAt(value, 0, out var rune) ||
            rune.Utf16SequenceLength != value.Length ||
            rune.Value is < 0x20 or '"' or '\\')
        {
            return false;
        }

        byteLength = rune.Utf8SequenceLength;
        return true;
    }

    static bool TryGetSafePrefix(string value, out int scalarCount, out int byteLength)
    {
        scalarCount = 0;
        byteLength = 0;
        foreach (var rune in value.EnumerateRunes())
        {
            if (rune.Value is < 0x20 or '"' or '\\')
            {
                return false;
            }
            scalarCount++;
        }

        byteLength = Encoding.UTF8.GetByteCount(value);
        return true;
    }

    static bool TryGetArrayLength(int count, bool firstItemIsEmptyArray, out int exactLength)
    {
        if (count == 0)
        {
            exactLength = 2;
            return true;
        }

        return TrySetLength((5L * count) + 1 - (firstItemIsEmptyArray ? 2 : 0), out exactLength);
    }

    static bool TrySetLength(long value, out int exactLength)
    {
        if (value is < 0 or > MaximumGeneratedBytes)
        {
            exactLength = 0;
            return false;
        }

        exactLength = checked((int)value);
        return true;
    }

    static long PowerOfTen(int digits)
    {
        var result = 1L;
        for (var digit = 0; digit < digits; digit++)
        {
            result = checked(result * 10L);
        }
        return result;
    }

    static bool TryGetBase64DecodedLength(string value, out int decodedLength)
    {
        decodedLength = 0;
        if (value.Length == 0)
        {
            return true;
        }
        if (value.Length % 4 != 0)
        {
            return false;
        }

        var padding = 0;
        if (value.EndsWith("==", StringComparison.Ordinal))
        {
            padding = 2;
        }
        else if (value.EndsWith('='))
        {
            padding = 1;
        }
        var contentLength = value.Length - padding;
        for (var index = 0; index < contentLength; index++)
        {
            if (Base64Value(value[index]) < 0)
            {
                return false;
            }
        }
        for (var index = contentLength; index < value.Length; index++)
        {
            if (value[index] != '=')
            {
                return false;
            }
        }

        if ((padding == 2 && (Base64Value(value[contentLength - 1]) & 0x0f) != 0) ||
            (padding == 1 && (Base64Value(value[contentLength - 1]) & 0x03) != 0))
        {
            return false;
        }

        var length = ((long)value.Length / 4 * 3) - padding;
        if (length > MaximumGeneratedBytes)
        {
            return false;
        }
        decodedLength = checked((int)length);
        return true;
    }

    static int Base64Value(char value) => value switch
    {
        >= 'A' and <= 'Z' => value - 'A',
        >= 'a' and <= 'z' => value - 'a' + 26,
        >= '0' and <= '9' => value - '0' + 52,
        '+' => 62,
        '/' => 63,
        _ => -1
    };

    static bool Only(VectorGenerator generator, params string[] allowed)
    {
        var names = allowed.ToHashSet(StringComparer.Ordinal);
        return (generator.Scalar is null || names.Contains(nameof(generator.Scalar))) &&
               (!generator.ScalarCount.HasValue || names.Contains(nameof(generator.ScalarCount))) &&
               (generator.KeyScalar is null || names.Contains(nameof(generator.KeyScalar))) &&
               (!generator.KeyScalarCount.HasValue || names.Contains(nameof(generator.KeyScalarCount))) &&
               (!generator.Count.HasValue || names.Contains(nameof(generator.Count))) &&
               (generator.KeyPrefix is null || names.Contains(nameof(generator.KeyPrefix))) &&
               (!generator.KeyDigits.HasValue || names.Contains(nameof(generator.KeyDigits))) &&
               (!generator.Depth.HasValue || names.Contains(nameof(generator.Depth))) &&
               (!generator.LeadingWhitespaceCount.HasValue || names.Contains(nameof(generator.LeadingWhitespaceCount))) &&
               (generator.ValueBase64 is null || names.Contains(nameof(generator.ValueBase64))) &&
               (generator.AScalar is null || names.Contains(nameof(generator.AScalar))) &&
               (!generator.AScalarCount.HasValue || names.Contains(nameof(generator.AScalarCount))) &&
               (generator.BScalar is null || names.Contains(nameof(generator.BScalar))) &&
               (!generator.BScalarCount.HasValue || names.Contains(nameof(generator.BScalarCount))) &&
               (generator.HashField is null || names.Contains(nameof(generator.HashField))) &&
               (generator.PayloadScalar is null || names.Contains(nameof(generator.PayloadScalar))) &&
               (!generator.PayloadScalarCount.HasValue || names.Contains(nameof(generator.PayloadScalarCount)));
    }

    static byte[] Generate(VectorGenerator generator, int exactLength) => generator.Kind switch
    {
        "repeatedString" => WriteRepeatedString(generator.Scalar!, generator.ScalarCount!.Value, exactLength),
        "singlePropertyObject" => WriteSinglePropertyObject(generator.KeyScalar!, generator.KeyScalarCount!.Value, exactLength),
        "arrayOfNulls" => WriteArray(generator.Count!.Value, false, exactLength),
        "arrayWithOneEmptyArrayItem" => WriteArray(generator.Count!.Value, true, exactLength),
        "objectWithNullMembers" => WriteObject(generator, false, exactLength),
        "objectWithOneEmptyObjectMember" => WriteObject(generator, true, exactLength),
        "nestedArrays" => WriteNestedArrays(generator.Depth!.Value, exactLength),
        "paddedValue" => WritePaddedValue(generator, exactLength),
        "twoStringObject" => WriteTwoStringObject(generator, exactLength),
        "selfHashObject" => WriteSelfHashObject(generator, exactLength),
        _ => throw new InvalidVectorManifest()
    };

    static byte[] WriteRepeatedString(string scalar, int count, int exactLength)
    {
        var encoded = EncodedScalar(scalar);
        var result = new byte[exactLength];
        var offset = 0;
        result[offset++] = (byte)'"';
        WriteRepeated(encoded, count, result, ref offset);
        result[offset++] = (byte)'"';
        EnsureComplete(result, offset);
        return result;
    }

    static byte[] WriteSinglePropertyObject(string scalar, int count, int exactLength)
    {
        var encoded = EncodedScalar(scalar);
        var result = new byte[exactLength];
        var offset = 0;
        result[offset++] = (byte)'{';
        result[offset++] = (byte)'"';
        WriteRepeated(encoded, count, result, ref offset);
        result[offset++] = (byte)'"';
        Write(":null}"u8, result, ref offset);
        EnsureComplete(result, offset);
        return result;
    }

    static byte[] WriteArray(int count, bool firstItemIsEmptyArray, int exactLength)
    {
        var result = new byte[exactLength];
        var offset = 0;
        result[offset++] = (byte)'[';
        for (var index = 0; index < count; index++)
        {
            if (index > 0)
            {
                result[offset++] = (byte)',';
            }
            Write(firstItemIsEmptyArray && index == 0 ? "[]"u8 : "null"u8, result, ref offset);
        }
        result[offset++] = (byte)']';
        EnsureComplete(result, offset);
        return result;
    }

    static byte[] WriteObject(VectorGenerator generator, bool firstMemberIsEmptyObject, int exactLength)
    {
        var prefix = generator.Count == 0 ? [] : Encoding.UTF8.GetBytes(generator.KeyPrefix!);
        var result = new byte[exactLength];
        var offset = 0;
        result[offset++] = (byte)'{';
        for (var index = 0; index < generator.Count!.Value; index++)
        {
            if (index > 0)
            {
                result[offset++] = (byte)',';
            }
            result[offset++] = (byte)'"';
            Write(prefix, result, ref offset);
            Write(Encoding.ASCII.GetBytes(index.ToString($"D{generator.KeyDigits}", CultureInfo.InvariantCulture)), result, ref offset);
            Write("\":"u8, result, ref offset);
            Write(firstMemberIsEmptyObject && index == 0 ? "{}"u8 : "null"u8, result, ref offset);
        }
        result[offset++] = (byte)'}';
        EnsureComplete(result, offset);
        return result;
    }

    static byte[] WriteNestedArrays(int depth, int exactLength)
    {
        var result = new byte[exactLength];
        result.AsSpan(0, depth).Fill((byte)'[');
        "null"u8.CopyTo(result.AsSpan(depth));
        result.AsSpan(depth + 4, depth).Fill((byte)']');
        return result;
    }

    static byte[] WritePaddedValue(VectorGenerator generator, int exactLength)
    {
        var value = Convert.FromBase64String(generator.ValueBase64!);
        var result = new byte[exactLength];
        result.AsSpan(0, generator.LeadingWhitespaceCount!.Value).Fill((byte)' ');
        value.CopyTo(result, generator.LeadingWhitespaceCount.Value);
        EnsureComplete(result, generator.LeadingWhitespaceCount.Value + value.Length);
        return result;
    }

    static byte[] WriteTwoStringObject(VectorGenerator generator, int exactLength)
    {
        var result = new byte[exactLength];
        var offset = 0;
        Write("{\"a\":"u8, result, ref offset);
        WriteQuotedRepeated(generator.AScalar!, generator.AScalarCount!.Value, result, ref offset);
        Write(",\"b\":"u8, result, ref offset);
        WriteQuotedRepeated(generator.BScalar!, generator.BScalarCount!.Value, result, ref offset);
        result[offset++] = (byte)'}';
        EnsureComplete(result, offset);
        return result;
    }

    static byte[] WriteSelfHashObject(VectorGenerator generator, int exactLength)
    {
        var result = new byte[exactLength];
        var offset = 0;
        Write("{\"payload\":"u8, result, ref offset);
        WriteQuotedRepeated(generator.PayloadScalar!, generator.PayloadScalarCount!.Value, result, ref offset);
        result[offset++] = (byte)'}';
        EnsureComplete(result, offset);
        return result;
    }

    static void WriteQuotedRepeated(string scalar, int count, byte[] destination, ref int offset)
    {
        destination[offset++] = (byte)'"';
        WriteRepeated(EncodedScalar(scalar), count, destination, ref offset);
        destination[offset++] = (byte)'"';
    }

    static void WriteRepeated(byte[] value, int count, byte[] destination, ref int offset)
    {
        for (var index = 0; index < count; index++)
        {
            Write(value, destination, ref offset);
        }
    }

    static void Write(ReadOnlySpan<byte> value, byte[] destination, ref int offset)
    {
        var next = checked(offset + value.Length);
        if (next > destination.Length)
        {
            throw new InvalidVectorManifest();
        }
        value.CopyTo(destination.AsSpan(offset));
        offset = next;
    }

    static byte[] EncodedScalar(string scalar) => Encoding.UTF8.GetBytes(scalar);

    static void EnsureComplete(byte[] result, int offset)
    {
        if (offset != result.Length)
        {
            throw new InvalidVectorManifest();
        }
    }
}

sealed class InvalidVectorManifest(string code = "generator-invalid") : Exception
{
    public string Code { get; } = code;
}
