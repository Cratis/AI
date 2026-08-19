// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Conformance;

static class CanonicalJsonVectorGeneratorValidator
{
    const int MaximumGeneratedInputBytes = CanonicalJsonLimits.MaximumInputBytes + 1;

    public static bool IsValid(CanonicalJsonVector vector) => TryGetInputLength(vector, out _);

    public static int GetValidatedInputLength(CanonicalJsonVector vector)
    {
        if (!TryGetInputLength(vector, out var length))
        {
            throw new InvalidDataException("The canonical JSON vector generator is invalid or exceeds its bounded input contract.");
        }

        return length;
    }

    static bool TryGetInputLength(CanonicalJsonVector vector, out int inputLength)
    {
        inputLength = 0;
        var generator = vector.Generator;
        if (generator is null || !TryGetKindInputLength(vector, generator, out var length) ||
            length is < 0 or > MaximumGeneratedInputBytes ||
            (length > CanonicalJsonLimits.MaximumInputBytes && !IsExplicitInputTooLargeRejection(vector)))
        {
            return false;
        }

        inputLength = (int)length;
        return true;
    }

    static bool TryGetKindInputLength(CanonicalJsonVector vector, CanonicalJsonVectorGenerator generator, out long length)
    {
        length = 0;
        var populatedFields = CountPopulatedFields(generator);
        return generator.Kind switch
        {
            "repeatedString" => populatedFields == 2 && TryGetRepeatedStringLength(vector, generator.Scalar, generator.ScalarCount, out length),
            "singlePropertyObject" => populatedFields == 2 && TryGetSinglePropertyObjectLength(vector, generator, out length),
            "arrayOfNulls" => populatedFields == 1 && TryGetArrayLength(vector, generator.Count, false, out length),
            "arrayWithOneEmptyArrayItem" => populatedFields == 1 && TryGetArrayLength(vector, generator.Count, true, out length),
            "objectWithNullMembers" => populatedFields == 3 && TryGetObjectLength(vector, generator, false, out length),
            "objectWithOneEmptyObjectMember" => populatedFields == 3 && TryGetObjectLength(vector, generator, true, out length),
            "nestedArrays" => populatedFields == 1 && TryGetNestedArrayLength(vector, generator.Depth, out length),
            "paddedValue" => populatedFields == 2 && TryGetPaddedValueLength(generator, out length),
            "twoStringObject" => populatedFields == 4 && TryGetTwoStringObjectLength(vector, generator, out length),
            "selfHashObject" => populatedFields == 3 && TryGetSelfHashObjectLength(vector, generator, out length),
            _ => false
        };
    }

    static bool TryGetRepeatedStringLength(CanonicalJsonVector vector, string? scalar, int? count, out long length)
    {
        length = 0;
        if (!CanonicalJsonVectorGeneratorText.TryGetSingleScalarByteLength(scalar, out var scalarBytes) ||
            !IsBoundaryCount(vector, count, CanonicalJsonLimits.MaximumStringScalars, CanonicalJsonFailureCode.StringTooLong))
        {
            return false;
        }

        length = checked(2L + ((long)scalarBytes * count!.Value));
        return true;
    }

    static bool TryGetSinglePropertyObjectLength(CanonicalJsonVector vector, CanonicalJsonVectorGenerator generator, out long length)
    {
        if (!TryGetRepeatedStringLength(vector, generator.KeyScalar, generator.KeyScalarCount, out var keyLength))
        {
            length = 0;
            return false;
        }

        length = checked(keyLength + 7L);
        return true;
    }

    static bool TryGetArrayLength(CanonicalJsonVector vector, int? count, bool firstItemIsEmptyArray, out long length)
    {
        length = 0;
        if (!IsBoundaryCount(vector, count, CanonicalJsonLimits.MaximumArrayItems, CanonicalJsonFailureCode.ArrayItemLimitExceeded))
        {
            return false;
        }

        length = count == 0 ? 2 : checked(1L + (count!.Value * 5L) - (firstItemIsEmptyArray ? 2L : 0L));
        return true;
    }

    static bool TryGetObjectLength(CanonicalJsonVector vector, CanonicalJsonVectorGenerator generator, bool firstValueIsEmptyObject, out long length)
    {
        length = 0;
        var keyDigits = generator.KeyDigits.GetValueOrDefault();
        if (!IsBoundaryCount(vector, generator.Count, CanonicalJsonLimits.MaximumObjectMembers, CanonicalJsonFailureCode.ObjectMemberLimitExceeded) ||
            keyDigits is < 1 or > 10 ||
            !CanonicalJsonVectorGeneratorText.TryGetPrefixLengths(generator.KeyPrefix, out var prefixScalars, out var prefixBytes) ||
            prefixScalars + keyDigits > CanonicalJsonLimits.MaximumStringScalars ||
            generator.Count > DecimalCapacity(keyDigits))
        {
            return false;
        }

        length = generator.Count == 0
            ? 2
            : checked(1L + (generator.Count!.Value * (prefixBytes + keyDigits + 8L)) - (firstValueIsEmptyObject ? 2L : 0L));
        return true;
    }

    static bool TryGetNestedArrayLength(CanonicalJsonVector vector, int? depth, out long length)
    {
        length = 0;
        if (!IsBoundaryCount(vector, depth, CanonicalJsonLimits.MaximumNestingDepth, CanonicalJsonFailureCode.NestingTooDeep, 1))
        {
            return false;
        }

        length = checked((depth!.Value * 2L) + 4L);
        return true;
    }

    static bool TryGetPaddedValueLength(CanonicalJsonVectorGenerator generator, out long length)
    {
        length = 0;
        if (generator.LeadingWhitespaceCount is null or < 0 ||
            !CanonicalJsonVectorGeneratorText.TryGetBase64DecodedLength(generator.ValueBase64, out var valueLength))
        {
            return false;
        }

        length = checked((long)generator.LeadingWhitespaceCount.Value + valueLength);
        return true;
    }

    static bool TryGetTwoStringObjectLength(CanonicalJsonVector vector, CanonicalJsonVectorGenerator generator, out long length)
    {
        if (!TryGetRepeatedStringLength(vector, generator.AScalar, generator.AScalarCount, out var aLength) ||
            !TryGetRepeatedStringLength(vector, generator.BScalar, generator.BScalarCount, out var bLength))
        {
            length = 0;
            return false;
        }

        length = checked(aLength + bLength + 11L);
        return true;
    }

    static bool TryGetSelfHashObjectLength(CanonicalJsonVector vector, CanonicalJsonVectorGenerator generator, out long length)
    {
        if (!string.Equals(generator.HashField, vector.Operation, StringComparison.Ordinal) ||
            !CanonicalJsonVectorOperation.IsSelfHash(vector) ||
            !CanonicalJsonVectorOperation.IsCalculate(vector) ||
            !TryGetRepeatedStringLength(vector, generator.PayloadScalar, generator.PayloadScalarCount, out var payloadLength))
        {
            length = 0;
            return false;
        }

        length = checked(payloadLength + 12L);
        return true;
    }

    static bool IsBoundaryCount(
        CanonicalJsonVector vector,
        int? count,
        int maximum,
        CanonicalJsonFailureCode boundaryFailure,
        int minimum = 0) =>
        count is not null &&
        count >= minimum &&
        count <= maximum + 1 &&
        (count <= maximum || IsExpectedRejection(vector, boundaryFailure));

    static bool IsExplicitInputTooLargeRejection(CanonicalJsonVector vector) =>
        IsExpectedRejection(vector, CanonicalJsonFailureCode.InputTooLarge) &&
        HasFlag(vector, "inputBytes") &&
        HasFlag(vector, "boundary") &&
        HasFlag(vector, "preDomRejection");

    static bool IsExpectedRejection(CanonicalJsonVector vector, CanonicalJsonFailureCode failure) =>
        !vector.Expected.Accepted && string.Equals(vector.Expected.ErrorCode, failure.ToString(), StringComparison.Ordinal);

    static bool HasFlag(CanonicalJsonVector vector, string flag) => vector.Flags?.Contains(flag, StringComparer.Ordinal) == true;

    static long DecimalCapacity(int digits)
    {
        var capacity = 1L;
        for (var index = 0; index < digits; index++)
        {
            capacity = checked(capacity * 10L);
        }

        return capacity;
    }

    static int CountPopulatedFields(CanonicalJsonVectorGenerator generator) =>
        (generator.Scalar is null ? 0 : 1) +
        (generator.ScalarCount.HasValue ? 1 : 0) +
        (generator.KeyScalar is null ? 0 : 1) +
        (generator.KeyScalarCount.HasValue ? 1 : 0) +
        (generator.Count.HasValue ? 1 : 0) +
        (generator.KeyPrefix is null ? 0 : 1) +
        (generator.KeyDigits.HasValue ? 1 : 0) +
        (generator.Depth.HasValue ? 1 : 0) +
        (generator.LeadingWhitespaceCount.HasValue ? 1 : 0) +
        (generator.ValueBase64 is null ? 0 : 1) +
        (generator.AScalar is null ? 0 : 1) +
        (generator.AScalarCount.HasValue ? 1 : 0) +
        (generator.BScalar is null ? 0 : 1) +
        (generator.BScalarCount.HasValue ? 1 : 0) +
        (generator.HashField is null ? 0 : 1) +
        (generator.PayloadScalar is null ? 0 : 1) +
        (generator.PayloadScalarCount.HasValue ? 1 : 0);
}
