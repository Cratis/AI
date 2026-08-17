// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;

namespace Cratis.Factory.Conformance;

static class CanonicalJsonVectorInput
{
    public static byte[] Create(CanonicalJsonVector vector)
    {
        if (vector.InputBase64 is not null)
        {
            return Convert.FromBase64String(vector.InputBase64);
        }

        var expectedLength = CanonicalJsonVectorGeneratorValidator.GetValidatedInputLength(vector);
        var result = Generate(vector.Generator!, expectedLength);
        if (result.Length != expectedLength)
        {
            throw new InvalidDataException("The canonical JSON vector generator produced an unexpected byte length.");
        }

        return result;
    }

    static byte[] Generate(CanonicalJsonVectorGenerator generator, int expectedLength) => generator.Kind switch
    {
        "repeatedString" => RepeatedString(generator.Scalar!, generator.ScalarCount!.Value),
        "singlePropertyObject" => SinglePropertyObject(generator.KeyScalar!, generator.KeyScalarCount!.Value),
        "arrayOfNulls" => ArrayOfNulls(generator.Count!.Value, false),
        "arrayWithOneEmptyArrayItem" => ArrayOfNulls(generator.Count!.Value, true),
        "objectWithNullMembers" => ObjectWithNullMembers(generator, false, expectedLength),
        "objectWithOneEmptyObjectMember" => ObjectWithNullMembers(generator, true, expectedLength),
        "nestedArrays" => NestedArrays(generator.Depth!.Value),
        "paddedValue" => PaddedValue(generator.LeadingWhitespaceCount!.Value, generator.ValueBase64!),
        "twoStringObject" => TwoStringObject(generator),
        "selfHashObject" => SelfHashObject(generator.PayloadScalar!, generator.PayloadScalarCount!.Value),
        _ => throw new UnknownCanonicalJsonVectorGenerator(generator.Kind)
    };

    static byte[] RepeatedString(string scalar, int count)
    {
        var scalarBytes = Encoding.UTF8.GetBytes(scalar);
        var result = new byte[checked((scalarBytes.Length * count) + 2)];
        result[0] = (byte)'"';
        for (var index = 0; index < count; index++)
        {
            scalarBytes.CopyTo(result, 1 + (index * scalarBytes.Length));
        }

        result[^1] = (byte)'"';
        return result;
    }

    static byte[] SinglePropertyObject(string scalar, int count)
    {
        var key = RepeatedString(scalar, count);
        var result = new byte[checked(key.Length + 7)];
        result[0] = (byte)'{';
        key.CopyTo(result, 1);
        Encoding.ASCII.GetBytes(":null}", result.AsSpan(key.Length + 1));
        return result;
    }

    static byte[] ArrayOfNulls(int count, bool firstItemIsEmptyArray)
    {
        var length = count == 0 ? 2 : checked((count * 5) + 1 - (firstItemIsEmptyArray ? 2 : 0));
        var result = new byte[length];
        var offset = 0;
        result[offset++] = (byte)'[';
        for (var index = 0; index < count; index++)
        {
            if (index > 0)
            {
                result[offset++] = (byte)',';
            }

            var value = firstItemIsEmptyArray && index == 0 ? "[]" : "null";
            offset += Encoding.ASCII.GetBytes(value, result.AsSpan(offset));
        }

        result[offset] = (byte)']';
        return result;
    }

    static byte[] ObjectWithNullMembers(CanonicalJsonVectorGenerator generator, bool firstValueIsEmptyObject, int expectedLength)
    {
        var writer = new ArrayBufferWriter<byte>(expectedLength);
        writer.Write("{"u8);
        for (var index = 0; index < generator.Count!.Value; index++)
        {
            if (index > 0)
            {
                writer.Write(","u8);
            }

            var key = $"{generator.KeyPrefix}{index.ToString($"D{generator.KeyDigits}", CultureInfo.InvariantCulture)}";
            writer.Write(Encoding.UTF8.GetBytes($"\"{key}\":"));
            writer.Write(firstValueIsEmptyObject && index == 0 ? "{}"u8 : "null"u8);
        }

        writer.Write("}"u8);
        return writer.WrittenSpan.ToArray();
    }

    static byte[] NestedArrays(int depth)
    {
        var result = new byte[checked((depth * 2) + 4)];
        result.AsSpan(0, depth).Fill((byte)'[');
        "null"u8.CopyTo(result.AsSpan(depth));
        result.AsSpan(depth + 4, depth).Fill((byte)']');
        return result;
    }

    static byte[] PaddedValue(int whitespaceCount, string valueBase64)
    {
        var value = Convert.FromBase64String(valueBase64);
        var result = new byte[checked(whitespaceCount + value.Length)];
        result.AsSpan(0, whitespaceCount).Fill((byte)' ');
        value.CopyTo(result, whitespaceCount);
        return result;
    }

    static byte[] TwoStringObject(CanonicalJsonVectorGenerator generator)
    {
        var a = RepeatedString(generator.AScalar!, generator.AScalarCount!.Value);
        var b = RepeatedString(generator.BScalar!, generator.BScalarCount!.Value);
        var result = new byte[checked(a.Length + b.Length + 11)];
        var offset = Encoding.ASCII.GetBytes("{\"a\":", result);
        a.CopyTo(result, offset);
        offset += a.Length;
        offset += Encoding.ASCII.GetBytes(",\"b\":", result.AsSpan(offset));
        b.CopyTo(result, offset);
        result[^1] = (byte)'}';
        return result;
    }

    static byte[] SelfHashObject(string scalar, int count)
    {
        var payload = RepeatedString(scalar, count);
        var result = new byte[checked(payload.Length + 12)];
        var offset = Encoding.ASCII.GetBytes("{\"payload\":", result);
        payload.CopyTo(result, offset);
        result[^1] = (byte)'}';
        return result;
    }
}
